package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1/fake"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8testing "k8s.io/client-go/testing"
)

func TestNewConnectionStatusPatcher(t *testing.T) {
	client := &fake.FakeProvisioningV0alpha1{}
	patcher := NewConnectionStatusPatcher(client)
	require.NotNil(t, patcher)
	require.Equal(t, client, patcher.client)
}

func TestConnectionStatusPatcher_Patch(t *testing.T) {
	tests := []struct {
		name            string
		conn            *provisioning.Connection
		patchOperations []map[string]interface{}
		reactorFunc     func(action k8testing.Action) (bool, runtime.Object, error)
		expectedError   string
	}{
		{
			name: "successful patch",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
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
				return true, &provisioning.Connection{}, nil
			},
		},
		{
			name: "patch marshal error",
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
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
			conn: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-connection",
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
			expectedError: "unable to update connection status: patch request failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := fake.FakeProvisioningV0alpha1{
				Fake: &k8testing.Fake{},
			}

			if tt.reactorFunc != nil {
				client.AddReactor("patch", "connections", tt.reactorFunc)
			}

			patcher := NewConnectionStatusPatcher(&client)
			err := patcher.Patch(context.Background(), tt.conn, tt.patchOperations...)

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
				require.Equal(t, tt.conn.Namespace, patchAction.GetNamespace())
				require.Equal(t, tt.conn.Name, patchAction.GetName())

				// Verify patch data
				expectedPatch, _ := json.Marshal(tt.patchOperations)
				require.Equal(t, expectedPatch, patchAction.GetPatch())
			}
		})
	}
}

func TestConnectionStatusPatcher_Patch_RetriesOnConflict(t *testing.T) {
	conn := &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{Name: "test-connection", Namespace: "test-namespace"},
	}
	ops := []map[string]interface{}{
		{"op": "replace", "path": "/status/health", "value": map[string]interface{}{"healthy": true}},
	}

	t.Run("transient conflict is retried and succeeds", func(t *testing.T) {
		var calls int32
		c := fake.FakeProvisioningV0alpha1{Fake: &k8testing.Fake{}}
		c.AddReactor("patch", "connections", func(action k8testing.Action) (bool, runtime.Object, error) {
			n := atomic.AddInt32(&calls, 1)
			if n == 1 {
				return true, nil, apierrors.NewConflict(
					schema.GroupResource{Group: provisioning.GROUP, Resource: "connections"},
					"test-connection",
					fmt.Errorf("requested RV does not match current RV"),
				)
			}
			return true, &provisioning.Connection{}, nil
		})

		err := NewConnectionStatusPatcher(&c).Patch(context.Background(), conn, ops...)
		require.NoError(t, err)
		require.Equal(t, int32(2), atomic.LoadInt32(&calls), "patch should retry once after conflict")
	})

	t.Run("persistent conflict surfaces the error", func(t *testing.T) {
		var calls int32
		c := fake.FakeProvisioningV0alpha1{Fake: &k8testing.Fake{}}
		c.AddReactor("patch", "connections", func(action k8testing.Action) (bool, runtime.Object, error) {
			atomic.AddInt32(&calls, 1)
			return true, nil, apierrors.NewConflict(
				schema.GroupResource{Group: provisioning.GROUP, Resource: "connections"},
				"test-connection",
				fmt.Errorf("requested RV does not match current RV"),
			)
		})

		err := NewConnectionStatusPatcher(&c).Patch(context.Background(), conn, ops...)
		require.Error(t, err)
		require.ErrorContains(t, err, "unable to update connection status")
		require.Greater(t, atomic.LoadInt32(&calls), int32(1), "patch should retry at least once before giving up")
	})

	t.Run("non-conflict errors are not retried", func(t *testing.T) {
		var calls int32
		c := fake.FakeProvisioningV0alpha1{Fake: &k8testing.Fake{}}
		c.AddReactor("patch", "connections", func(action k8testing.Action) (bool, runtime.Object, error) {
			atomic.AddInt32(&calls, 1)
			return true, nil, fmt.Errorf("boom")
		})

		err := NewConnectionStatusPatcher(&c).Patch(context.Background(), conn, ops...)
		require.Error(t, err)
		require.Equal(t, int32(1), atomic.LoadInt32(&calls), "non-conflict errors should not be retried")
	})

	t.Run("transient SQLITE_BUSY is retried and succeeds", func(t *testing.T) {
		var calls int32
		c := fake.FakeProvisioningV0alpha1{Fake: &k8testing.Fake{}}
		c.AddReactor("patch", "connections", func(action k8testing.Action) (bool, runtime.Object, error) {
			n := atomic.AddInt32(&calls, 1)
			if n == 1 {
				// Mimics the wrapped error returned by the unified storage SQL
				// backend when SQLite write contention bubbles up through the
				// apiserver as an internal error.
				return true, nil, apierrors.NewInternalError(fmt.Errorf(
					"transactional operation: resource update: resource_update.sql: " +
						"Exec with 10 input arguments and 0 output destination arguments: " +
						"database is locked (5) (SQLITE_BUSY); query: UPDATE \"resource\" SET ...",
				))
			}
			return true, &provisioning.Connection{}, nil
		})

		err := NewConnectionStatusPatcher(&c).Patch(context.Background(), conn, ops...)
		require.NoError(t, err)
		require.Equal(t, int32(2), atomic.LoadInt32(&calls), "patch should retry once after SQLITE_BUSY")
	})
}
