package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/util/retry"
)

type RepositoryStatusPatcher struct {
	client client.ProvisioningV0alpha1Interface
}

func NewRepositoryStatusPatcher(client client.ProvisioningV0alpha1Interface) *RepositoryStatusPatcher {
	return &RepositoryStatusPatcher{
		client: client,
	}
}

// isRetriablePatchError returns true for transient errors that should be retried
// when patching a repository status subresource. We retry K8s optimistic-concurrency
// conflicts (the apiserver translates JSON Patch into read-modify-write keyed on RV)
// and SQLite write contention surfaced from the unified storage backend.
func isRetriablePatchError(err error) bool {
	if err == nil {
		return false
	}
	if apierrors.IsConflict(err) {
		return true
	}
	// SQLite serializes writes; lock contention surfaces as an InternalError (500)
	// whose message carries the raw "database is locked"/"SQLITE_BUSY" text from
	// the unified storage layer. The PRAGMA busy_timeout already absorbs short
	// waits, so anything that bubbles up here is rare and safe to retry.
	msg := err.Error()
	return strings.Contains(msg, "SQLITE_BUSY") || strings.Contains(msg, "database is locked")
}

func (r *RepositoryStatusPatcher) Patch(ctx context.Context, repo *provisioning.Repository, patchOperations ...map[string]interface{}) error {
	patch, err := json.Marshal(patchOperations)
	if err != nil {
		return fmt.Errorf("unable to marshal patch data: %w", err)
	}

	err = retry.OnError(retry.DefaultRetry, isRetriablePatchError, func() error {
		_, err := r.client.Repositories(repo.Namespace).
			Patch(ctx, repo.Name, types.JSONPatchType, patch, metav1.PatchOptions{}, "status")
		return err
	})
	if err != nil {
		return fmt.Errorf("unable to update repo with job status: %w", err)
	}

	return nil
}
