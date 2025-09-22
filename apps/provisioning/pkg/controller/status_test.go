package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1/fake"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8testing "k8s.io/client-go/testing"
)

func TestNewRepositoryStatusPatcher(t *testing.T) {
	client := &fake.FakeProvisioningV0alpha1{}
	patcher := NewRepositoryStatusPatcher(client)
	require.NotNil(t, patcher)
	require.Equal(t, client, patcher.client)
}

func TestRepositoryStatusPatcher_Patch(t *testing.T) {
	tests := []struct {
		name            string
		repo            *provisioning.Repository
		patchOperations []map[string]interface{}
		reactorFunc     func(action k8testing.Action) (bool, runtime.Object, error)
		expectedError   string
	}{
		{
			name: "successful patch",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "test-namespace",
				},
			},
			patchOperations: []map[string]interface{}{
				{
					"op":   "replace",
					"path": "/status/health",
					"value": map[string]interface{}{
						"healthy": true,
						"message": []string{},
					},
				},
			},
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, &provisioning.Repository{}, nil
			},
		},
		{
			name: "patch marshal error",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "test-namespace",
				},
			},
			patchOperations: []map[string]interface{}{
				{
					"op":    "replace",
					"path":  "/status/health",
					"value": make(chan int), // This will cause json.Marshal to fail
				},
			},
			expectedError: "unable to marshal patch data: json: unsupported type: chan int",
		},
		{
			name: "patch request error",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "test-namespace",
				},
			},
			patchOperations: []map[string]interface{}{
				{
					"op":   "replace",
					"path": "/status/health",
					"value": map[string]interface{}{
						"healthy": true,
						"message": []string{},
					},
				},
			},
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, nil, fmt.Errorf("patch request failed")
			},
			expectedError: "unable to update repo with job status: patch request failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := fake.FakeProvisioningV0alpha1{
				Fake: &k8testing.Fake{},
			}

			if tt.reactorFunc != nil {
				client.AddReactor("patch", "repositories", tt.reactorFunc)
			}

			patcher := NewRepositoryStatusPatcher(&client)
			err := patcher.Patch(context.Background(), tt.repo, tt.patchOperations...)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			if tt.reactorFunc != nil {
				actions := client.Actions()
				require.Len(t, actions, 1)

				patchAction := actions[0].(k8testing.PatchAction)
				require.Equal(t, "status", patchAction.GetSubresource())
				require.Equal(t, tt.repo.Namespace, patchAction.GetNamespace())
				require.Equal(t, tt.repo.Name, patchAction.GetName())

				// Verify patch data
				expectedPatch, _ := json.Marshal(tt.patchOperations)
				require.Equal(t, expectedPatch, patchAction.GetPatch())
			}
		})
	}
}
