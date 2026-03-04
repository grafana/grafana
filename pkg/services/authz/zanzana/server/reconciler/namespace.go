package reconciler

import (
	"context"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

// fetchGlobalRolePerms fetches cluster-scoped GlobalRole resources and resolves their
// effective permissions (following RoleRefs + PermissionsOmitted). The returned map is
// shared across all namespace workers for Role composition and per-namespace injection.
func (r *Reconciler) fetchGlobalRolePerms(ctx context.Context) (
	map[string][]*authzextv1.RolePermission,
	error,
) {
	ctx, span := r.tracer.Start(ctx, "reconciler.fetchGlobalRolePerms")
	defer span.End()

	gvr := iamv0.GlobalRoleInfo.GroupVersionResource()

	clients, err := r.clientFactory.Clients(ctx, "")
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get cluster clients: %w", err)
	}
	resourceClient, _, err := clients.ForResource(ctx, gvr)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get client for %s: %w", gvr, err)
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
		span.RecordError(err)
		return nil, fmt.Errorf("failed to list GlobalRoles: %w", err)
	}

	// 2. Resolve effective permissions for each GlobalRole (handles RoleRefs + PermissionsOmitted).
	resolvedPerms, err := resolveAllGlobalRolePermissions(allGlobalRoles)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to resolve GlobalRole permissions: %w", err)
	}

	return resolvedPerms, nil
}

// resolveAllGlobalRolePermissions resolves effective permissions for all GlobalRoles using
// Kahn's topological sort (iterative). Roles with no RoleRefs are processed first; each
// dependent role is processed once all its referenced roles are done. Returns an error if
// any RoleRef points to a non-existent GlobalRole or if a cycle is detected.
func resolveAllGlobalRolePermissions(
	allGlobalRoles map[string]*iamv0.GlobalRole,
) (map[string][]*authzextv1.RolePermission, error) {
	// Validate: all RoleRefs must point to roles present in the map.
	for name, gr := range allGlobalRoles {
		for _, ref := range gr.Spec.RoleRefs {
			if _, ok := allGlobalRoles[ref.Name]; !ok {
				return nil, fmt.Errorf("GlobalRole %q references non-existent GlobalRole %q", name, ref.Name)
			}
		}
	}

	// Build reverse-adjacency and in-degree maps for Kahn's algorithm.
	// Edge direction: A depends on B (A has B in RoleRefs) → process B before A.
	inDegree := make(map[string]int, len(allGlobalRoles))        // inDegree[name] = number of roles that depend on name
	dependents := make(map[string][]string, len(allGlobalRoles)) // dependents[name] = roles that depend on name
	queue := make([]string, 0, len(allGlobalRoles))              // queue of roles to process (BFS)
	for name, gr := range allGlobalRoles {
		numDeps := len(gr.Spec.RoleRefs)
		inDegree[name] = numDeps
		if numDeps == 0 {
			// Seed the queue with roles that have no dependencies (custom roles / leaf nodes).
			queue = append(queue, name)
		}
		// Loop through all roleRefs (even if there is only one for now) and add the dependent role to the dependents map.
		for _, ref := range gr.Spec.RoleRefs {
			dependents[ref.Name] = append(dependents[ref.Name], name)
		}
	}

	resolved := make(map[string][]*authzextv1.RolePermission, len(allGlobalRoles))

	for len(queue) > 0 {
		name := queue[0]
		queue = queue[1:]

		gr := allGlobalRoles[name]
		effective := make(map[string]*authzextv1.RolePermission)

		if len(gr.Spec.RoleRefs) > 0 {
			// Inherit from referenced roles, then apply own delta.
			omitted := make(map[string]bool, len(gr.Spec.PermissionsOmitted))
			for _, p := range gr.Spec.PermissionsOmitted {
				omitted[p.Action+"|"+p.Scope] = true
			}
			// Only one roleRef should be in RoleRefs, but we'll loop through all of them to be safe.
			for _, roleRef := range gr.Spec.RoleRefs {
				for _, p := range resolved[roleRef.Name] {
					if !omitted[p.Action+"|"+p.Scope] {
						effective[p.Action+"|"+p.Scope] = p
					}
				}
			}
		}
		// Own Permissions are additions (basic role) or the complete set (custom role).
		for _, p := range gr.Spec.Permissions {
			effective[p.Action+"|"+p.Scope] = &authzextv1.RolePermission{Action: p.Action, Scope: p.Scope}
		}

		result := make([]*authzextv1.RolePermission, 0, len(effective))
		for _, p := range effective {
			result = append(result, p)
		}
		resolved[name] = result

		// Unblock roles that were waiting on this one.
		for _, dependent := range dependents[name] {
			inDegree[dependent]--
			if inDegree[dependent] == 0 {
				queue = append(queue, dependent)
			}
		}
	}

	// Any role still in inDegree > 0 is part of a cycle.
	if len(resolved) < len(allGlobalRoles) {
		var cycleRoles []string
		for name, deg := range inDegree {
			if deg > 0 {
				cycleRoles = append(cycleRoles, name)
			}
		}
		return nil, fmt.Errorf("cycle detected in GlobalRole RoleRefs involving: %v", cycleRoles)
	}

	return resolved, nil
}

// fetchAndTranslateTuples fetches CRDs from Unistore and translates them directly to tuples.
// This streaming approach avoids keeping all CRDs in memory.
//
// GlobalRole tuples are injected selectively: only GlobalRoles that are NOT referenced by any
// namespace Role are added standalone. GlobalRoles that ARE referenced already have their
// permissions inlined into the namespace Role's tuples via translateRoleToTuples composition.
func (r *Reconciler) fetchAndTranslateTuples(ctx context.Context, namespace string) ([]*openfgav1.TupleKey, error) {
	ctx, span := r.tracer.Start(ctx, "reconciler.fetchAndTranslateTuples")
	defer span.End()

	globalRolePerms := r.getGlobalRolePerms()
	allTuples := make([]*openfgav1.TupleKey, 0, len(globalRolePerms)*2)

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
	}

	// Process each GVR type and translate to tuples immediately
	for _, gvr := range reconcileGVRs {
		translator, ok := translators[gvr.Resource]
		if !ok {
			err := fmt.Errorf("no translator found for resource type: %s", gvr.Resource)
			span.RecordError(err)
			return nil, err
		}

		tuples, err := r.fetchAndTranslateGVR(ctx, namespace, gvr, translator)
		if err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("failed to process %s: %w", gvr.Resource, err)
		}

		allTuples = append(allTuples, tuples...)
	}

	// For GlobalRoles not referenced by any namespace Role, add their tuples directly.
	// Referenced GlobalRoles are already inlined into namespace Role tuples above.
	for roleName, perms := range globalRolePerms {
		if referencedGlobalRoles[roleName] {
			continue
		}
		tuples, err := zanzana.RoleToTuples(roleName, perms)
		if err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("failed to generate tuples for unlinked GlobalRole %s: %w", roleName, err)
		}
		allTuples = append(allTuples, tuples...)
	}

	return allTuples, nil
}

// fetchAndTranslateGVR fetches CRDs of a specific type and translates them to tuples.
func (r *Reconciler) fetchAndTranslateGVR(
	ctx context.Context,
	namespace string,
	gvr schema.GroupVersionResource,
	translator func(*unstructured.Unstructured) ([]*openfgav1.TupleKey, error),
) ([]*openfgav1.TupleKey, error) {
	ctx, span := r.tracer.Start(ctx, "reconciler.fetchAndTranslateGVR", trace.WithAttributes(
		attribute.String("gvr.group", gvr.Group),
		attribute.String("gvr.version", gvr.Version),
		attribute.String("gvr.resource", gvr.Resource),
	))
	defer span.End()

	var allTuples []*openfgav1.TupleKey

	// Get the dynamic client for this namespace
	clients, err := r.clientFactory.Clients(ctx, namespace)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get clients for namespace %s: %w", namespace, err)
	}

	// Get the resource interface for the specific GVR
	resourceClient, _, err := clients.ForResource(ctx, gvr)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get client for resource %s: %w", gvr.String(), err)
	}

	// Stream through pages using the Kubernetes dynamic client
	err = listAndProcess(ctx, resourceClient, func(item *unstructured.Unstructured) error {
		tuples, err := translator(item)
		if err != nil {
			return fmt.Errorf("failed to translate %s/%s: %w", gvr.Resource, item.GetName(), err)
		}
		allTuples = append(allTuples, tuples...)
		return nil
	})

	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	return allTuples, nil
}

// listAndProcess is a helper function that lists all resources and processes each one.
// It handles pagination using Kubernetes continuation tokens.
func listAndProcess(ctx context.Context, client dynamic.ResourceInterface, fn func(*unstructured.Unstructured) error) error {
	var continueToken string

	for {
		list, err := client.List(ctx, metav1.ListOptions{
			Limit:    10000, // Page size
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

// readAllTuplesFromZanzana reads all tuples from Zanzana for a namespace.
func (r *Reconciler) readAllTuplesFromZanzana(ctx context.Context, namespace string) ([]*openfgav1.TupleKey, error) {
	ctx, span := r.tracer.Start(ctx, "reconciler.readAllTuplesFromZanzana")
	defer span.End()

	var allTuples []*openfgav1.TupleKey
	var continuationToken string

	// Get store info for the namespace
	storeInfo, err := r.server.GetOrCreateStore(ctx, namespace)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get store info: %w", err)
	}

	// Read all tuples using pagination
	for {
		req := &openfgav1.ReadRequest{
			StoreId:           storeInfo.ID,
			PageSize:          nil, // Use default page size
			ContinuationToken: continuationToken,
		}

		resp, err := r.server.GetOpenFGAServer().Read(ctx, req)
		if err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("failed to read tuples: %w", err)
		}

		// Extract tuple keys from tuples
		for _, tuple := range resp.GetTuples() {
			allTuples = append(allTuples, tuple.GetKey())
		}

		if resp.GetContinuationToken() == "" {
			break
		}
		continuationToken = resp.GetContinuationToken()
	}

	return allTuples, nil
}

// writeTuplesToZanzana applies the diff (additions and deletions) to Zanzana in batches.
// If a batch fails, it logs the error and continues with the next batch.
// Uses the server's WriteTuples method directly to avoid authzextv1 ↔ openfgav1 conversions.
func (r *Reconciler) writeTuplesToZanzana(ctx context.Context, namespace string, toAdd, toDelete []*openfgav1.TupleKey) error {
	ctx, span := r.tracer.Start(ctx, "reconciler.writeTuplesToZanzana")
	defer span.End()

	// Get store info for the namespace
	storeInfo, err := r.server.GetOrCreateStore(ctx, namespace)
	if err != nil {
		span.RecordError(err)
		return fmt.Errorf("failed to get store info: %w", err)
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

	// If total tuples fit in one batch, write directly
	totalTuples := len(toAdd) + len(deleteTuples)
	if totalTuples <= batchSize {
		err := r.server.WriteTuples(ctx, storeInfo, toAdd, deleteTuples)
		if err == nil {
			r.metrics.tuplesWrittenTotal.WithLabelValues("add").Add(float64(len(toAdd)))
			r.metrics.tuplesWrittenTotal.WithLabelValues("delete").Add(float64(len(deleteTuples)))
		} else {
			span.RecordError(err)
		}
		return err
	}

	// Process in batches
	failedBatches := 0
	successfulBatches := 0

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
			failedBatches++
		} else {
			r.metrics.tuplesWrittenTotal.WithLabelValues("add").Add(float64(len(batchWrites)))
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
			failedBatches++
		} else {
			r.metrics.tuplesWrittenTotal.WithLabelValues("delete").Add(float64(len(batchDeletes)))
			successfulBatches++
		}
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
		err := fmt.Errorf("failed to write %d out of %d batches", failedBatches, successfulBatches+failedBatches)
		span.RecordError(err)
		return err
	}

	return nil
}
