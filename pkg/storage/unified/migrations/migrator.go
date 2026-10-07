package migrations

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/metadata"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/dskit/backoff"
	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// MigrateOptions contains configuration for a resource migration operation.
type MigrateOptions struct {
	Namespace   string
	Resources   []schema.GroupResource
	WithHistory bool // only applies to dashboards
	Progress    func(count int, msg string)
}

// Read from legacy and write into unified storage
type UnifiedMigrator interface {
	Migrate(ctx context.Context, opts MigrateOptions) (*resourcepb.BulkResponse, error)
	RebuildIndexes(ctx context.Context, opts RebuildIndexOptions) error
}

// unifiedMigration handles the migration of legacy resources to unified storage
type unifiedMigration struct {
	streamProvider streamProvider
	client         resource.ResourceClient
	log            log.Logger
	registry       *MigrationRegistry
	rebuildBackoff *backoff.Config
}

type Option func(*unifiedMigration)

func WithRebuildBackoff(cfg backoff.Config) Option {
	return func(m *unifiedMigration) {
		m.rebuildBackoff = &cfg
	}
}

// streamProvider abstracts the different ways to create a bulk process stream
type streamProvider interface {
	createStream(ctx context.Context, opts MigrateOptions) (resourcepb.BulkStore_BulkProcessClient, error)
}

func buildCollectionSettings(opts MigrateOptions) resource.BulkSettings {
	settings := resource.BulkSettings{SkipValidation: true}
	for _, res := range opts.Resources {
		settings.Collection = append(settings.Collection, buildResourceKey(res, opts.Namespace))
	}
	return settings
}

type resourceClientStreamProvider struct {
	client resource.ResourceClient
}

func (r *resourceClientStreamProvider) createStream(ctx context.Context, opts MigrateOptions) (resourcepb.BulkStore_BulkProcessClient, error) {
	settings := buildCollectionSettings(opts)
	ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
	return r.client.BulkProcess(ctx)
}

// This can migrate Folders, Dashboards, LibraryPanels and Playlists
func ProvideUnifiedMigrator(
	client resource.ResourceClient,
	registry *MigrationRegistry,
) UnifiedMigrator {
	return NewUnifiedMigrator(client, registry)
}

func NewUnifiedMigrator(
	client resource.ResourceClient,
	registry *MigrationRegistry,
	opts ...Option,
) UnifiedMigrator {
	return newUnifiedMigrator(
		&resourceClientStreamProvider{client: client},
		client,
		log.New("storage.unified.migrator"),
		registry,
		opts...,
	)
}

func newUnifiedMigrator(
	streamProvider streamProvider,
	client resource.ResourceClient,
	log log.Logger,
	registry *MigrationRegistry,
	opts ...Option,
) UnifiedMigrator {
	m := &unifiedMigration{
		streamProvider: streamProvider,
		client:         client,
		log:            log,
		registry:       registry,
	}
	for _, opt := range opts {
		opt(m)
	}
	return m
}

func (m *unifiedMigration) Migrate(ctx context.Context, opts MigrateOptions) (*resourcepb.BulkResponse, error) {
	info, err := authlib.ParseNamespace(opts.Namespace)
	if err != nil {
		return nil, err
	}
	if opts.Progress == nil {
		opts.Progress = func(count int, msg string) {} // noop
	}

	if len(opts.Resources) < 1 {
		return nil, fmt.Errorf("missing resource selector")
	}

	// Use a cancellable context for the stream so that if a migration function
	// fails, the server-side handler is notified and releases its bulk lock.
	streamCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	stream, err := m.streamProvider.createStream(streamCtx, opts)
	if err != nil {
		return nil, err
	}

	migratorFuncs := []MigratorFunc{}
	for _, res := range opts.Resources {
		fn := m.registry.GetMigratorFunc(res)
		if fn == nil {
			return nil, fmt.Errorf("unsupported resource: %s/%s", res.Group, res.Resource)
		}
		migratorFuncs = append(migratorFuncs, fn)
	}

	// Execute migrations
	m.log.Info("start migrating legacy resources", "namespace", opts.Namespace, "orgId", info.OrgID, "stackId", info.StackID)
	for _, fn := range migratorFuncs {
		err := fn(ctx, info.OrgID, opts, stream)
		if err != nil {
			m.log.Error("error migrating legacy resources", "error", err, "namespace", opts.Namespace)
			return nil, err
		}
	}
	m.log.Info("finished migrating legacy resources", "namespace", opts.Namespace, "orgId", info.OrgID, "stackId", info.StackID)
	return stream.CloseAndRecv()
}

type RebuildIndexOptions struct {
	UsingDistributor    bool
	NamespaceInfo       authlib.NamespaceInfo
	Resources           []schema.GroupResource
	MigrationFinishedAt time.Time
}

var (
	singleInstanceRebuildBackoff = backoff.Config{
		MinBackoff: 500 * time.Millisecond,
		MaxBackoff: 3 * time.Second,
		MaxRetries: 5,
	}

	distributorRebuildBackoff = backoff.Config{
		MinBackoff: 5 * time.Second,
		MaxBackoff: 30 * time.Second,
		MaxRetries: 10,
	}
)

func (m *unifiedMigration) backoffConfig(opts RebuildIndexOptions) backoff.Config {
	switch {
	case m.rebuildBackoff != nil:
		return *m.rebuildBackoff
	case opts.UsingDistributor:
		return distributorRebuildBackoff
	default:
		return singleInstanceRebuildBackoff
	}
}

func (m *unifiedMigration) RebuildIndexes(ctx context.Context, opts RebuildIndexOptions) error {
	logger := m.log.New("namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID, "resources", opts.Resources)
	logger.Info("start rebuilding index for resources")

	cfg := m.backoffConfig(opts)
	boff := backoff.New(ctx, cfg)

	var lastErr error
	for boff.Ongoing() {
		err := m.rebuildIndexes(ctx, opts)
		if err == nil {
			logger.Info("finished rebuilding index for resources", "attempts", boff.NumRetries()+1)
			return nil
		}

		lastErr = err
		logger.Error("retrying rebuild indexes", "error", err, "attempt", boff.NumRetries()+1, "maxAttempts", cfg.MaxRetries)
		boff.Wait()
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("unknown error rebuilding indexes after %d attempts", boff.NumRetries())
	}

	err := fmt.Errorf("%w: last rebuild error: %w", boff.ErrCause(), lastErr)
	if ctx.Err() != nil {
		logger.Error("context ended while rebuilding indexes", "error", err, "attempts", boff.NumRetries())
	} else {
		logger.Error("failed to rebuild indexes after retries", "error", err, "attempts", boff.NumRetries())
	}

	return err
}

func (m *unifiedMigration) rebuildIndexes(ctx context.Context, opts RebuildIndexOptions) error {
	keys := []*resourcepb.ResourceKey{}
	for _, res := range opts.Resources {
		keys = append(keys, buildResourceKey(res, opts.NamespaceInfo.Value))
	}

	response, err := m.client.RebuildIndexes(ctx, &resourcepb.RebuildIndexesRequest{
		Namespace: opts.NamespaceInfo.Value,
		Keys:      keys,
	})
	if err := resource.ErrorFromResponse(response.GetError(), err); err != nil {
		m.log.Error("error rebuilding index for resource", "error", err, "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID, "resources", opts.Resources)
		return fmt.Errorf("rebuild index error: %w", err)
	}

	if opts.UsingDistributor {
		if !response.ContactedAllInstances {
			m.log.Error("distributor did not contact all instances", "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID, "resources", opts.Resources)
			return fmt.Errorf("rebuild index error: distributor did not contact all instances")
		}

		m.log.Info("distributor contacted all instances", "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID)

		buildTimeMap := make(map[string]int64)
		for _, bt := range response.BuildTimes {
			key := bt.Group + "/" + bt.Resource
			buildTimeMap[key] = bt.BuildTimeUnix
		}

		// RebuildIndexes checks freshness against the import time before reporting build times.
		// Accept the finish second: build times are only reported at second precision.
		migrationFinishTime := opts.MigrationFinishedAt.Unix()

		// Only validate resources that have a build time reported.
		// Resources with no data (and therefore no index) won't have a build time,
		// and that's fine - we skip validation for those.
		for _, res := range opts.Resources {
			key := res.Group + "/" + res.Resource
			buildTime, found := buildTimeMap[key]
			if !found {
				m.log.Info("no build time reported for resource, skipping validation (index may not exist)", "resource", key, "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID)
				continue
			}

			if buildTime < migrationFinishTime {
				m.log.Error("index build time is before migration finished", "resource", key, "build_time", time.Unix(buildTime, 0), "migration_finished_at", opts.MigrationFinishedAt, "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID)
				return fmt.Errorf("rebuild index error: index for %s was built before migration finished (built at %s, migration finished at %s)", key, time.Unix(buildTime, 0), opts.MigrationFinishedAt)
			}

			m.log.Info("verified index build time", "resource", key, "build_time", time.Unix(buildTime, 0), "migration_finished_at", opts.MigrationFinishedAt, "namespace", opts.NamespaceInfo.Value, "orgId", opts.NamespaceInfo.OrgID)
		}
	}

	return nil
}
