package resource

import (
	"context"
	"fmt"
	"math/rand/v2"
	"strconv"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/gcom"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// TenantDeleterConfig holds configuration for the TenantDeleter.
type TenantDeleterConfig struct {
	DryRun   bool
	Interval time.Duration
	Log      log.Logger
	// Gcom, when non-nil, is used to confirm the stack is removed in GCOM before local
	// tenant data is deleted: GetInstanceByID returns Instance with Status "deleted".
	Gcom gcom.Service
}

// NewTenantDeleterConfig creates a TenantDeleterConfig from Grafana settings and returns nil
// when tenant deleter is not enabled.
func NewTenantDeleterConfig(cfg *setting.Cfg) *TenantDeleterConfig {
	if cfg == nil || !cfg.EnableTenantDeleter {
		return nil
	}

	interval := cfg.TenantDeleterInterval
	if interval <= 0 {
		interval = 1 * time.Hour
	}

	return &TenantDeleterConfig{
		DryRun:   cfg.TenantDeleterDryRun,
		Interval: interval,
		Log:      log.New("tenant-deleter"),
	}
}

// TenantDeleter periodically checks the pending-delete store and removes
// expired tenant data from the data store.
type TenantDeleter struct {
	log                log.Logger
	pendingDeleteStore *PendingDeleteStore
	dataStore          *dataStore
	cfg                TenantDeleterConfig
	gcom               gcom.Service
	stopCh             chan struct{}
}

// NewTenantDeleter creates a new TenantDeleter. It does NOT start the background goroutine.
func NewTenantDeleter(ds *dataStore, pds *PendingDeleteStore, cfg TenantDeleterConfig) *TenantDeleter {
	return &TenantDeleter{
		log:                cfg.Log,
		pendingDeleteStore: pds,
		dataStore:          ds,
		cfg:                cfg,
		gcom:               cfg.Gcom,
		stopCh:             make(chan struct{}),
	}
}

// Start launches the background deletion loop. It applies an initial jitter
// before the first tick to avoid thundering herd.
func (td *TenantDeleter) Start(ctx context.Context) {
	go func() {
		jitter := time.Duration(rand.Int64N(int64(td.cfg.Interval)))
		select {
		case <-time.After(jitter):
		case <-ctx.Done():
			return
		case <-td.stopCh:
			return
		}

		td.runDeletionPass(ctx)

		ticker := time.NewTicker(td.cfg.Interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-td.stopCh:
				return
			case <-ticker.C:
				td.runDeletionPass(ctx)
			}
		}
	}()
}

// Stop signals the background goroutine to exit.
func (td *TenantDeleter) Stop() {
	close(td.stopCh)
}

// runDeletionPass iterates all pending-delete records and deletes data for
// tenants whose deletion time has passed.
func (td *TenantDeleter) runDeletionPass(ctx context.Context) {
	groupResources, err := td.dataStore.getGroupResources(ctx)
	if err != nil {
		td.log.Error("failed to list group resources", "error", err)
		return
	}

	for key, err := range td.pendingDeleteStore.kv.Keys(ctx, pendingDeleteSection, ListOptions{}) {
		if err != nil {
			td.log.Error("failed to list pending delete records", "error", err)
			return
		}

		tenantName := key

		record, err := td.pendingDeleteStore.Get(ctx, tenantName)
		if err != nil {
			td.log.Warn("failed to get pending delete record", "tenant", tenantName, "error", err)
			continue
		}

		if record.DeletedAt != "" {
			// Already fully deleted; skip.
			continue
		}

		deleteAfter, err := time.Parse(time.RFC3339, record.DeleteAfter)
		if err != nil {
			td.log.Warn("failed to parse delete-after time", "tenant", tenantName, "value", record.DeleteAfter)
			continue
		}

		if time.Now().UTC().Before(deleteAfter) {
			// Not yet expired; skip.
			continue
		}

		if !td.gcomAllowsTenantDeletion(ctx, tenantName) {
			continue
		}

		if err := td.deleteTenant(ctx, tenantName, groupResources); err != nil {
			td.log.Error("failed to delete tenant data", "tenant", tenantName, "error", err)
		}
	}
}

// gcomAllowsTenantDeletion returns true when GCOM returns 200 with Status "deleted" for the given
// tenant name. Otherwise it returns false and logs.
func (td *TenantDeleter) gcomAllowsTenantDeletion(ctx context.Context, tenantName string) bool {
	ctx, span := tracer.Start(ctx, "resource.TenantDeleter.gcomAllowsTenantDeletion", trace.WithAttributes(
		attribute.String("tenant", tenantName),
	))
	defer span.End()

	if td.gcom == nil {
		return false
	}

	info, err := types.ParseNamespace(tenantName)
	if err != nil || info.StackID <= 0 {
		td.log.Error("GCOM verification requires a cloud stack namespace (stacks-{stackId}); skipping local data deletion",
			"tenant", tenantName, "err", err, "stack_id", info.StackID)
		span.RecordError(err)
		span.SetStatus(codes.Error, "invalid namespace")
		return false
	}
	instanceID := strconv.FormatInt(info.StackID, 10)
	span.SetAttributes(attribute.String("gcom_instance_id", instanceID))

	reqID := tracing.TraceIDFromContext(ctx, false)
	gcomStart := time.Now()
	inst, err := td.gcom.GetInstanceByID(ctx, reqID, instanceID)
	gcomDuration := time.Since(gcomStart)
	span.SetAttributes(attribute.Int64("gcom_request_duration_ms", gcomDuration.Milliseconds()))

	if err != nil {
		td.log.Error("GCOM instance check failed; skipping local data deletion",
			"tenant", tenantName, "gcom_instance_id", instanceID, "err", err,
			"gcom_request_duration_ms", gcomDuration.Milliseconds())
		span.RecordError(err)
		span.SetStatus(codes.Error, "GCOM request failed")
		return false
	}

	span.SetAttributes(attribute.String("gcom_status", inst.Status))
	if inst.Status != "deleted" {
		td.log.Warn("stack still active in GCOM; skipping local data deletion",
			"tenant", tenantName, "gcom_instance_id", instanceID, "gcom_status", inst.Status)
		return false
	}

	return true
}

// deleteTenant removes all resource data for the given tenant from the data
// store, then removes its pending-delete record.
func (td *TenantDeleter) deleteTenant(ctx context.Context, tenantName string, groupResources []GroupResource) error {
	ctx, span := tracer.Start(ctx, "resource.TenantDeleter.deleteTenant", trace.WithAttributes(
		attribute.String("tenant", tenantName),
		attribute.Bool("dry_run", td.cfg.DryRun),
		attribute.Int("group_resources", len(groupResources)),
	))
	defer span.End()

	start := time.Now()
	td.log.Info("tenant data deletion", "tenant", tenantName, "dry_run", td.cfg.DryRun)

	var totalKeys int
	for _, gr := range groupResources {
		listKey := ListRequestKey{
			Group:     gr.Group,
			Resource:  gr.Resource,
			Namespace: tenantName,
		}

		prefix := listKey.Prefix()
		var keys []DataKey
		for k, err := range td.dataStore.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: prefix,
			EndKey:   PrefixRangeEnd(prefix),
		}) {
			if err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, "listing resource keys failed")
				return err
			}
			dk, err := ParseKey(k)
			if err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, "parsing resource key failed")
				return err
			}
			keys = append(keys, dk)
		}

		if td.cfg.DryRun {
			td.log.Info("dry run: would delete tenant resources",
				"tenant", tenantName,
				"group", gr.Group,
				"resource", gr.Resource,
				"count", len(keys),
			)
			continue
		}

		grStart := time.Now()
		if err := td.dataStore.batchDelete(ctx, keys); err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "batch delete failed")
			return err
		}
		td.log.Info("deleted tenant resources",
			"tenant", tenantName,
			"group", gr.Group,
			"resource", gr.Resource,
			"count", len(keys),
			"duration_ms", time.Since(grStart).Milliseconds(),
		)
		totalKeys += len(keys)
	}

	span.SetAttributes(
		attribute.Int("total_keys_deleted", totalKeys),
		attribute.Int64("duration_ms", time.Since(start).Milliseconds()),
	)
	td.log.Info("tenant data deletion complete",
		"tenant", tenantName,
		"dry_run", td.cfg.DryRun,
		"total_keys_deleted", totalKeys,
		"duration_ms", time.Since(start).Milliseconds(),
	)

	if td.cfg.DryRun {
		return nil
	}

	record, err := td.pendingDeleteStore.Get(ctx, tenantName)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "reading pending delete record failed")
		return fmt.Errorf("reading pending delete record: %w", err)
	}

	// Orphaned records are manually seeded and won't be recreated by the
	// tenant watcher, so we can safely remove them after cleanup.
	if record.Orphaned {
		return td.pendingDeleteStore.Delete(ctx, tenantName)
	}

	// Non-orphaned records must be kept with a DeletedAt timestamp to prevent
	// the tenant watcher from recreating them while the tenant API still has
	// the tenant with a pending-delete label.
	record.DeletedAt = time.Now().UTC().Format(time.RFC3339)
	return td.pendingDeleteStore.Upsert(ctx, tenantName, record)
}
