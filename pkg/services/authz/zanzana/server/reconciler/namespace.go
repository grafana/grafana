package reconciler

import (
	"context"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

// fetchAndTranslateTuples fetches CRDs from Unistore and translates them directly to tuples.
// This streaming approach avoids keeping all CRDs in memory.
func (r *Reconciler) fetchAndTranslateTuples(ctx context.Context, namespace string) ([]*openfgav1.TupleKey, error) {
	var allTuples []*openfgav1.TupleKey

	// Map resource types to their translation functions
	translators := map[string]func(*unstructured.Unstructured) ([]*openfgav1.TupleKey, error){
		"folders":             TranslateFolderToTuples,
		"roles":               TranslateRoleToTuples,
		"rolebindings":        TranslateRoleBindingToTuples,
		"resourcepermissions": TranslateResourcePermissionToTuples,
		"teambindings":        TranslateTeamBindingToTuples,
		"users":               TranslateUserToTuples,
	}

	// Process each GVR type and translate to tuples immediately
	for _, gvr := range reconcileGVRs {
		translator, ok := translators[gvr.Resource]
		if !ok {
			return nil, fmt.Errorf("no translator found for resource type: %s", gvr.Resource)
		}

		tuples, err := r.fetchAndTranslateGVR(ctx, namespace, gvr, translator)
		if err != nil {
			return nil, fmt.Errorf("failed to process %s: %w", gvr.Resource, err)
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
	var allTuples []*openfgav1.TupleKey

	// Get the dynamic client for this namespace
	clients, err := r.clientFactory.Clients(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get clients for namespace %s: %w", namespace, err)
	}

	// Get the resource interface for the specific GVR
	resourceClient, _, err := clients.ForResource(ctx, gvr)
	if err != nil {
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
			Limit:    100, // Page size
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
	var allTuples []*openfgav1.TupleKey
	var continuationToken string

	// Get store info for the namespace
	storeInfo, err := r.server.GetStoreInfo(ctx, namespace)
	if err != nil {
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
	// Get store info for the namespace
	storeInfo, err := r.server.GetStoreInfo(ctx, namespace)
	if err != nil {
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
		return r.server.WriteTuples(ctx, storeInfo, toAdd, deleteTuples)
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
		return fmt.Errorf("failed to write %d out of %d batches", failedBatches, successfulBatches+failedBatches)
	}

	return nil
}
