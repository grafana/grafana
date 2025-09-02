package controller

import (
	"context"
	"encoding/json"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type RepositoryStatusPatcher struct {
	client client.ProvisioningV0alpha1Interface
}

func NewRepositoryStatusPatcher(client client.ProvisioningV0alpha1Interface) *RepositoryStatusPatcher {
	return &RepositoryStatusPatcher{
		client: client,
	}
}

func (r *RepositoryStatusPatcher) Patch(ctx context.Context, repo *provisioning.Repository, patchOperations ...map[string]interface{}) error {
	patch, err := json.Marshal(patchOperations)
	if err != nil {
		return fmt.Errorf("unable to marshal patch data: %w", err)
	}

	_, err = r.client.Repositories(repo.Namespace).
		Patch(ctx, repo.Name, types.JSONPatchType, patch, metav1.PatchOptions{}, "status")
	if err != nil {
		return fmt.Errorf("unable to update repo with job status: %w", err)
	}

	return nil
}
