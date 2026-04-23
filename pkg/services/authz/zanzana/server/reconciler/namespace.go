package reconciler

import (
	"context"
	"fmt"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/wrapperspb"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

// tupleKey generates a unique string key for a tuple based on user, relation, and object.
// Conditions are intentionally excluded from the key — they are compared separately in
// computeDiffStreaming so that condition changes trigger a delete+re-add.
// Uses null-byte separators to prevent collisions between field values.
func tupleKey(tuple *openfgav1.TupleKey) string {
	return tuple.GetUser() + "\x00" + tuple.GetRelation() + "\x00" + tuple.GetObject()
}

// fetchGlobalRolePerms fetches cluster-scoped GlobalRole resources and collects their
// permissions. The returned map is shared across all namespace workers for Role
// composition and per-namespace injection.
func (r *Reconciler) fetchGlobalRolePerms(ctx context.Context) (
	map[string][]*authzextv1.RolePermission,
	error,
) {
	ctx, span := r.tracer.Start(ctx, "reconciler.fetchGlobalRolePerms")
	defer span.End()

	crd := iamv0.GlobalRoleInfo.GroupVersionResource()

	clients, err := r.clientFactory.Clients(ctx, "")
	if err != nil {
		return nil, tracing.Errorf(span, "failed to get cluster clients: %w", err)
	}
	resourceClient, _, err := clients.ForResource(ctx, crd)
	if err != nil {
		return nil, tracing.Errorf(span, "failed to get client for %s: %w", crd, err)
	}

	// 1. Collect all GlobalRole objects into a map for two-pass resolution.
	allGlobalRoles := make(map[string]*iamv0.GlobalRole)
	err = listAndProcess(ctx, resourceClient, func(item *unstructured.Unstructured) error {
		var gr iamv0.GlobalRole
		if err := convertUnstructured(item, &gr); err != nil {
			return err
		}
		allGlobalRoles[gr.Name] = &gr
		return nil
	})
	if err != nil {
		return nil, tracing.Errorf(span, "failed to list GlobalRoles: %w", err)
	}

	// 2. Collect permissions for each GlobalRole.
	resolvedPerms, err := resolveAllGlobalRolePermissions(allGlobalRoles)
	if err != nil {
		return nil, tracing.Errorf(span, "failed to resolve GlobalRole permissions: %w", err)
	}

	span.SetAttributes(attribute.Int("global_roles.count", len(resolvedPerms)))

	return resolvedPerms, nil
}

// resolveAllGlobalRolePermissions collects the effective permissions for each GlobalRole.
// GlobalRoles do not support RoleRefs, so each role's permissions are simply its own Permissions list.
func resolveAllGlobalRolePermissions(
	allGlobalRoles map[string]*iamv0.GlobalRole,
) (map[string][]*authzextv1.RolePermission, error) {
	resolved := make(map[string][]*authzextv1.RolePermission, len(allGlobalRoles))

	for name, gr := range allGlobalRoles {
		perms := make([]*authzextv1.RolePermission, 0, len(gr.Spec.Permissions))
		for _, p := range gr.Spec.Permissions {
			perms = append(perms, &authzextv1.RolePermission{Action: p.Action, Scope: p.Scope})
		}
		resolved[name] = perms
	}

	return resolved, nil
}

// fetchAndTranslateTuples fetches CRDs from Unistore and translates them directly into a
// map keyed by tupleKey.
//
// GlobalRole tuples are injected selectively: only GlobalRoles that are NOT referenced by any
// namespace Role are added standalone. GlobalRoles that ARE referenced already have their
// permissions inlined into the namespace Role's tuples via translateRoleToTuples composition.
func (r *Reconciler) fetchAndTranslateTuples(ctx context.Context, namespace string) (map[string]*openfgav1.TupleKey, error) {
	ctx, span := r.tracer.Start(ctx, "reconciler.fetchAndTranslateTuples", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()

	globalRolePerms := r.getGlobalRolePerms()
	expectedMap := make(map[string]*openfgav1.TupleKey, len(globalRolePerms)*2)

	// Track which GlobalRoles are referenced by namespace Roles via RoleRefs.
	// Those have their permissions inlined and must not be added as standalone tuples.
	referencedGlobalRoles := make(map[string]bool)

	// Map resource types to their translation functions
	translators := map[string]func(*unstructured.Unstructured) ([]*openfgav1.TupleKey, error){
		"folders": TranslateFolderToTuples,
		"roles": func(obj *unstructured.Unstructured) ([]*openfgav1.TupleKey, error) {
			// Collect RoleRefs so we know which GlobalRoles are already inlined.
			var role iamv0.Role
			if err := convertUnstructured(obj, &role); err == nil {
				for _, ref := range role.Spec.RoleRefs {
					referencedGlobalRoles[ref.Name] = true
				}
			}
			return translateRoleToTuples(obj, globalRolePerms)
		},
		"rolebindings":        TranslateRoleBindingToTuples,
		"resourcepermissions": TranslateResourcePermissionToTuples,
		"teambindings":        TranslateTeamBindingToTuples,
		"users":               TranslateUserToTuples,
		"serviceaccounts":     TranslateServiceAccountToTuples,
	}

	// Process each crd type and insert translated tuples directly into the map
	for _, crd := range r.cfg.CRDs {
		translator, ok := translators[crd.Resource]
		if !ok {
			return nil, tracing.Errorf(span, "no translator found for resource type: %s", crd.Resource)
		}

		if err := r.fetchAndTranslateCRD(ctx, namespace, crd, translator, expectedMap); err != nil {
			return nil, tracing.Errorf(span, "failed to process %s: %w", crd.Resource, err)
		}
	}

	// For GlobalRoles not referenced by any namespace Role, add their tuples directly.
	// Referenced GlobalRoles are already inlined into namespace Role tuples above.
	for roleName, perms := range globalRolePerms {
		if referencedGlobalRoles[roleName] {
			continue
		}
		tuples, err := zanzana.RoleToTuples(roleName, perms)
		if err != nil {
			return nil, tracing.Errorf(span, "failed to generate tuples for unlinked GlobalRole %s: %w", roleName, err)
		}
		for _, t := range tuples {
			expectedMap[tupleKey(t)] = t
		}
	}

	return expectedMap, nil
}

// fetchAndTranslateCRD fetches CRDs of a specific type and inserts translated tuples
// directly into the destination map
func (r *Reconciler) fetchAndTranslateCRD(
	ctx context.Context,
	namespace string,
	crd schema.GroupVersionResource,
	translator func(*unstructured.Unstructured) ([]*openfgav1.TupleKey, error),
	dest map[string]*openfgav1.TupleKey,
) error {
	ctx, span := r.tracer.Start(ctx, "reconciler.fetchAndTranslateCRD", trace.WithAttributes(
		attribute.String("crd.group", crd.Group),
		attribute.String("crd.version", crd.Version),
		attribute.String("crd.resource", crd.Resource),
	))
	defer span.End()

	start := time.Now()
	objectsFetched := 0
	tuplesProduced := 0

	// Get the dynamic client for this namespace
	clients, err := r.clientFactory.Clients(ctx, namespace)
	if err != nil {
		return tracing.Errorf(span, "failed to get clients for namespace %s: %w", namespace, err)
	}

	// Get the resource interface for the specific CRD
	resourceClient, _, err := clients.ForResource(ctx, crd)
	if err != nil {
		return tracing.Errorf(span, "failed to get client for resource %s: %w", crd.String(), err)
	}

	// Stream through pages using the Kubernetes dynamic client
	err = listAndProcess(ctx, resourceClient, func(item *unstructured.Unstructured) error {
		objectsFetched++
		tuples, err := translator(item)
		if err != nil {
			return fmt.Errorf("failed to translate %s/%s: %w", crd.Resource, item.GetName(), err)
		}
		tuplesProduced += len(tuples)
		for _, t := range tuples {
			dest[tupleKey(t)] = t
		}
		return nil
	})

	if err != nil {
		return tracing.Error(span, err)
	}

	elapsed := time.Since(start)

	span.SetAttributes(
		attribute.Int("crd.objects_fetched", objectsFetched),
		attribute.Int("crd.tuples_produced", tuplesProduced),
	)
	r.metrics.crdFetchDurationSeconds.WithLabelValues(crd.Resource).Observe(elapsed.Seconds())

	return nil
}

// listAndProcess is a helper function that lists all resources and processes each one.
// It handles pagination using Kubernetes continuation tokens.
func listAndProcess(ctx context.Context, client dynamic.ResourceInterface, fn func(*unstructured.Unstructured) error) error {
	var continueToken string

	for {
		list, err := client.List(ctx, metav1.ListOptions{
			Limit:    1000,
			Continue: continueToken,
		})
		if err != nil {
			return fmt.Errorf("failed to list resources: %w", err)
		}

		for i := range list.Items {
			if err := fn(&list.Items[i]); err != nil {
				return err
			}
		}

		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return nil
}

// computeDiffStreaming reads current tuples from Zanzana page-by-page and computes the diff
// against expectedMap. It mutates expectedMap by deleting matched entries; after return,
// remaining entries in expectedMap are returned as toAdd.
func (r *Reconciler) computeDiffStreaming(
	ctx context.Context, namespace string,
	expectedMap map[string]*openfgav1.TupleKey,
) (toAdd, toDelete []*openfgav1.TupleKey, err error) {
	ctx, span := r.tracer.Start(ctx, "reconciler.computeDiffStreaming", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()

	// Get store info for the namespace. The reconciler runs as a background
	// worker without end-user claims, so it calls the internal ReadTuples helper
	// (mirroring WriteTuples) to bypass the public-API authorization check.
	storeInfo, err := r.server.GetOrCreateStore(ctx, namespace)
	if err != nil {
		return nil, nil, tracing.Errorf(span, "failed to get store info: %w", err)
	}

	pagesRead := 0
	var continuationToken string

	// Read current tuples page-by-page and diff against expected
	for {
		req := &openfgav1.ReadRequest{
			PageSize:          wrapperspb.Int32(r.cfg.zanzanaReadPageSize()),
			ContinuationToken: continuationToken,
		}

		resp, err := r.server.ReadTuples(ctx, storeInfo, req)
		if err != nil {
			return nil, nil, tracing.Errorf(span, "failed to read tuples: %w", err)
		}

		pagesRead++

		for _, tuple := range resp.GetTuples() {
			key := tupleKey(tuple.GetKey())
			if expected, exists := expectedMap[key]; exists {
				if proto.Equal(expected.GetCondition(), tuple.GetKey().GetCondition()) {
					// Tuple is fully in sync — remove from expected
					delete(expectedMap, key)
				} else {
					// Same identity but condition changed — delete old, keep expected for re-add
					toDelete = append(toDelete, tuple.GetKey())
				}
			} else {
				// Tuple exists in Zanzana but not expected — needs deletion
				toDelete = append(toDelete, tuple.GetKey())
			}
		}

		if resp.GetContinuationToken() == "" {
			break
		}
		continuationToken = resp.GetContinuationToken()
	}

	// Remaining entries in expectedMap are missing from Zanzana — need to be added
	toAdd = make([]*openfgav1.TupleKey, 0, len(expectedMap))
	for _, tuple := range expectedMap {
		toAdd = append(toAdd, tuple)
	}

	span.SetAttributes(
		attribute.Int("diff.pages_read", pagesRead),
		attribute.Int("diff.tuples_to_add", len(toAdd)),
		attribute.Int("diff.tuples_to_delete", len(toDelete)),
	)

	return toAdd, toDelete, nil
}

// writeTuplesToZanzana applies the diff (additions and deletions) to Zanzana in batches.
// If a batch fails, it logs the error and continues with the next batch.
// Uses the server's WriteTuples method directly to avoid authzextv1 ↔ openfgav1 conversions.
func (r *Reconciler) writeTuplesToZanzana(ctx context.Context, namespace string, toAdd, toDelete []*openfgav1.TupleKey) error {
	ctx, span := r.tracer.Start(ctx, "reconciler.writeTuplesToZanzana", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()

	// Get store info for the namespace
	storeInfo, err := r.server.GetOrCreateStore(ctx, namespace)
	if err != nil {
		return tracing.Errorf(span, "failed to get store info: %w", err)
	}

	// Convert toDelete to TupleKeyWithoutCondition (required for deletes)
	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, len(toDelete))
	for i, tuple := range toDelete {
		deleteTuples[i] = &openfgav1.TupleKeyWithoutCondition{
			User:     tuple.User,
			Relation: tuple.Relation,
			Object:   tuple.Object,
		}
	}

	// Determine batch size (default to 100 if not configured or set to 0)
	batchSize := r.cfg.WriteBatchSize
	if batchSize <= 0 {
		batchSize = 100
	}

	span.SetAttributes(
		attribute.Int("write.total_adds", len(toAdd)),
		attribute.Int("write.total_deletes", len(deleteTuples)),
		attribute.Int("write.batch_size", batchSize),
	)

	// If total tuples fit in one batch, write directly
	totalTuples := len(toAdd) + len(deleteTuples)
	if totalTuples <= batchSize {
		err := r.server.WriteTuples(ctx, storeInfo, toAdd, deleteTuples)
		if err == nil {
			r.metrics.tuplesWrittenTotal.WithLabelValues("add").Add(float64(len(toAdd)))
			r.metrics.tuplesWrittenTotal.WithLabelValues("delete").Add(float64(len(deleteTuples)))
			span.SetAttributes(attribute.Int("write.failed_batches", 0))
			return nil
		}
		r.metrics.batchFailuresTotal.Inc()
		span.SetAttributes(attribute.Int("write.failed_batches", 1))
		return tracing.Error(span, err)
	}

	// Process in batches
	failedBatches := 0
	successfulBatches := 0
	addCounter := r.metrics.tuplesWrittenTotal.WithLabelValues("add")
	deleteCounter := r.metrics.tuplesWrittenTotal.WithLabelValues("delete")

	// Split writes into batches
	for i := 0; i < len(toAdd); i += batchSize {
		end := min(i+batchSize, len(toAdd))
		batchWrites := toAdd[i:end]

		if err := r.server.WriteTuples(ctx, storeInfo, batchWrites, nil); err != nil {
			r.logger.Error("Failed to write batch of additions",
				"namespace", namespace,
				"batchStart", i,
				"batchSize", len(batchWrites),
				"error", err,
			)
			r.metrics.batchFailuresTotal.Inc()
			failedBatches++
		} else {
			addCounter.Add(float64(len(batchWrites)))
			successfulBatches++
		}
	}

	// Split deletes into batches
	for i := 0; i < len(deleteTuples); i += batchSize {
		end := min(i+batchSize, len(deleteTuples))
		batchDeletes := deleteTuples[i:end]

		if err := r.server.WriteTuples(ctx, storeInfo, nil, batchDeletes); err != nil {
			r.logger.Error("Failed to write batch of deletions",
				"namespace", namespace,
				"batchStart", i,
				"batchSize", len(batchDeletes),
				"error", err,
			)
			r.metrics.batchFailuresTotal.Inc()
			failedBatches++
		} else {
			deleteCounter.Add(float64(len(batchDeletes)))
			successfulBatches++
		}
	}

	span.SetAttributes(attribute.Int("write.failed_batches", failedBatches))

	if failedBatches > 0 {
		r.metrics.errorsTotal.WithLabelValues("write_tuples_partial").Inc()
	}

	r.logger.Info("Completed batched tuple writes",
		"namespace", namespace,
		"successfulBatches", successfulBatches,
		"failedBatches", failedBatches,
		"totalWrites", len(toAdd),
		"totalDeletes", len(deleteTuples),
	)

	// Return error if any batches failed (for metrics/logging at higher level)
	if failedBatches > 0 {
		return tracing.Errorf(span, "failed to write %d out of %d batches", failedBatches, successfulBatches+failedBatches)
	}

	return nil
}
