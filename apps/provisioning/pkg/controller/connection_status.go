package controller

import (
	"context"
	"encoding/json"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/util/retry"
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

	// Retry optimistic-concurrency conflicts and SQLite write contention. With
	// multiple controller replicas, concurrent reconciles race on the same status
	// subresource; the loser gets a 409 the apiserver keys on resourceVersion.
	// Retrying re-reads fresh state and reapplies instead of surfacing a benign
	// race as an error the caller logs.
	err = retry.OnError(retry.DefaultRetry, isRetriablePatchError, func() error {
		_, err := p.client.Connections(conn.Namespace).
			Patch(ctx, conn.Name, types.JSONPatchType, patch, metav1.PatchOptions{}, "status")
		return err
	})
	if err != nil {
		return fmt.Errorf("unable to update connection status: %w", err)
	}

	return nil
}
