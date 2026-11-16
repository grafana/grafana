package dashboardpreferences

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/rest"
	clienttesting "k8s.io/client-go/testing"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

func TestIsNotFound(t *testing.T) {
	gr := dashv2beta1.DashboardPreferencesResourceInfo.GroupResource()

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "this object", err: apierrors.NewNotFound(gr, "user-u1"), want: true},
		{name: "wrapped", err: fmt.Errorf("update: %w", apierrors.NewNotFound(gr, "user-u1")), want: true},
		{
			name: "a 404 without a Status body",
			err:  apierrors.NewGenericServerResponse(http.StatusNotFound, http.MethodDelete, gr, "user-u1", "404 page not found", 0, true),
		},
		{name: "another object", err: apierrors.NewNotFound(gr, "user-u2")},
		{name: "another resource", err: apierrors.NewNotFound(schema.GroupResource{Group: gr.Group, Resource: "dashboards"}, "user-u1")},
		{name: "another group", err: apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: gr.Resource}, "user-u1")},
		{name: "a folder", err: apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), "u1")},
		{name: "a NotFound without details", err: &apierrors.StatusError{ErrStatus: metav1.Status{Reason: metav1.StatusReasonNotFound}}},
		{name: "another failure for this object", err: apierrors.NewForbidden(gr, "user-u1", errors.New("nope"))},
		{name: "not an API error", err: errors.New("dashboard preferences not found")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, IsNotFound(tt.err, "user-u1"))
		})
	}
}

func TestDeleteByName(t *testing.T) {
	info := dashv2beta1.DashboardPreferencesResourceInfo
	gr := info.GroupResource()

	tests := []struct {
		name      string
		deleteErr error
		wantErr   func(t *testing.T, err error)
	}{
		{name: "deletes the object"},
		{name: "a missing object is not an error", deleteErr: apierrors.NewNotFound(gr, "user-u1")},
		{
			name:      "a 404 without a Status body is not served",
			deleteErr: apierrors.NewGenericServerResponse(http.StatusNotFound, http.MethodDelete, gr, "user-u1", "404 page not found", 0, true),
			wantErr: func(t *testing.T, err error) {
				require.ErrorIs(t, err, ErrNotServed)
				require.False(t, apierrors.IsNotFound(err), "must not read as a missing object: %v", err)
				require.ErrorContains(t, err, "delete user-u1 in namespace org-2")
			},
		},
		{
			name:      "a 404 for another object is not served",
			deleteErr: apierrors.NewNotFound(gr, "user-u2"),
			wantErr: func(t *testing.T, err error) {
				require.ErrorIs(t, err, ErrNotServed)
				require.False(t, apierrors.IsNotFound(err), "must not read as a missing object: %v", err)
				require.ErrorContains(t, err, "delete user-u1 in namespace org-2")
			},
		},
		{
			name:      "another error is wrapped with the namespace and name",
			deleteErr: apierrors.NewForbidden(gr, "user-u1", errors.New("nope")),
			wantErr: func(t *testing.T, err error) {
				require.True(t, apierrors.IsForbidden(err), "want a Forbidden error, got %v", err)
				require.NotErrorIs(t, err, ErrNotServed)
				require.ErrorContains(t, err, "delete user-u1 in namespace org-2")
			},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			client := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
			var deletes []clienttesting.DeleteAction
			client.PrependReactor("delete", info.GetName(), func(action clienttesting.Action) (bool, runtime.Object, error) {
				deletes = append(deletes, action.(clienttesting.DeleteAction))
				return true, nil, tc.deleteErr
			})
			options := metav1.DeleteOptions{DryRun: []string{metav1.DryRunAll}}

			err := deleteByName(t.Context(), client.Resource(info.GroupVersionResource()), "org-2", "user-u1", options)

			if tc.wantErr == nil {
				require.NoError(t, err)
			} else {
				tc.wantErr(t, err)
			}
			require.Len(t, deletes, 1)
			require.Equal(t, "org-2", deletes[0].GetNamespace())
			require.Equal(t, "user-u1", deletes[0].GetName())
			require.Equal(t, options, deletes[0].GetDeleteOptions())
		})
	}
}

func TestDeleteByName_RouteNotServed(t *testing.T) {
	var deletes int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodDelete {
			deletes++
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(server.Close)
	client, err := dynamic.NewForConfig(&rest.Config{Host: server.URL})
	require.NoError(t, err)

	err = deleteByName(t.Context(), client.Resource(dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionResource()), "org-2", "user-u1", metav1.DeleteOptions{})

	require.Equal(t, 1, deletes)
	require.ErrorIs(t, err, ErrNotServed)
	require.False(t, apierrors.IsNotFound(err), "must not read as a missing object: %v", err)
}
