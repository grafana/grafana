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

// ConnectionStatusPatcher provides methods to patch Connection status subresources.
type ConnectionStatusPatcher struct {
	client client.ProvisioningV0alpha1Interface
}

// NewConnectionStatusPatcher creates a new ConnectionStatusPatcher.
func NewConnectionStatusPatcher(client client.ProvisioningV0alpha1Interface) *ConnectionStatusPatcher {
	return &ConnectionStatusPatcher{
		client: client,
	}
}

// Patch applies JSON patch operations to a Connection's status subresource.
func (p *ConnectionStatusPatcher) Patch(ctx context.Context, conn *provisioning.Connection, patchOperations ...map[string]interface{}) error {
	patch, err := json.Marshal(patchOperations)
	if err != nil {
		return fmt.Errorf("unable to marshal patch data: %w", err)
	}

	_, err = p.client.Connections(conn.Namespace).
		Patch(ctx, conn.Name, types.JSONPatchType, patch, metav1.PatchOptions{}, "status")
	if err != nil {
		return fmt.Errorf("unable to update connection status: %w", err)
	}

	return nil
}
