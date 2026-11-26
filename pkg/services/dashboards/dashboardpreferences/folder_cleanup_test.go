package dashboardpreferences

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestDeleteFolderPreferences(t *testing.T) {
	notFound := func(name string) fakeResponse {
		return fakeResponse{http.StatusNotFound, "application/json",
			`{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"NotFound","code":404,` +
				`"details":{"group":"dashboard.grafana.app","kind":"dashboardpreferences","name":"` + name + `"}}`}
	}

	tests := []struct {
		name        string
		namespace   string
		response    fakeResponse
		wantRequest []string
		wantErr     func(t *testing.T, err error)
	}{
		{
			name:        "deletes only the folder's tier",
			namespace:   "org-7",
			response:    statusSuccess,
			wantRequest: []string{"DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/org-7/dashboardpreferences/folder-f1"},
		},
		{
			name:        "a missing tier is not an error",
			namespace:   "org-7",
			response:    notFound("folder-f1"),
			wantRequest: []string{"DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/org-7/dashboardpreferences/folder-f1"},
		},
		{
			name:        "a route that isn't served is an error",
			namespace:   "org-7",
			response:    fakeResponse{http.StatusNotFound, "text/plain", "404 page not found"},
			wantRequest: []string{"DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/org-7/dashboardpreferences/folder-f1"},
			wantErr: func(t *testing.T, err error) {
				require.ErrorIs(t, err, ErrNotServed)
				require.False(t, apierrors.IsNotFound(err), "must not read as a missing object: %v", err)
				require.ErrorContains(t, err, "delete folder-f1 in namespace org-7")
			},
		},
		{
			name:        "a 404 for another object is an error",
			namespace:   "org-7",
			response:    notFound("folder-f2"),
			wantRequest: []string{"DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/org-7/dashboardpreferences/folder-f1"},
			wantErr: func(t *testing.T, err error) {
				require.ErrorIs(t, err, ErrNotServed)
				require.ErrorContains(t, err, "delete folder-f1 in namespace org-7")
			},
		},
		{
			name:      "any other error is returned",
			namespace: "default",
			response: fakeResponse{http.StatusForbidden, "application/json",
				`{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"Forbidden","code":403,"message":"access denied"}`},
			wantRequest: []string{"DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboardpreferences/folder-f1"},
			wantErr: func(t *testing.T, err error) {
				require.True(t, apierrors.IsForbidden(err), "want a Forbidden error, got %v", err)
				require.NotErrorIs(t, err, ErrNotServed)
				require.ErrorContains(t, err, "delete folder-f1 in namespace default")
			},
		},
		{
			name:      "a namespace that doesn't parse sends nothing",
			namespace: "org-x",
			wantErr: func(t *testing.T, err error) {
				require.ErrorContains(t, err, `invalid namespace "org-x"`)
			},
		},
		{
			name:      "an unknown namespace sends nothing",
			namespace: "users",
			wantErr: func(t *testing.T, err error) {
				require.ErrorIs(t, err, errNamespaceUnknown)
				require.ErrorContains(t, err, `invalid namespace "users"`)
			},
		},
		{
			name:      "an empty namespace sends nothing",
			namespace: "",
			wantErr: func(t *testing.T, err error) {
				require.ErrorIs(t, err, errNamespaceUnknown)
			},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			options := metav1.DeleteOptions{DryRun: []string{metav1.DryRunAll}}
			var requests []string
			rt := roundTripFunc(func(req *http.Request) (*http.Response, error) {
				requests = append(requests, req.Method+" "+req.URL.Path)
				assert.True(t, identity.IsServiceIdentity(req.Context()), "the delete must be sent as Grafana's service identity")
				requester, err := identity.GetRequester(req.Context())
				if assert.NoError(t, err) {
					assert.Equal(t, tc.namespace, requester.GetNamespace())
				}
				var got metav1.DeleteOptions
				if assert.NoError(t, json.NewDecoder(req.Body).Decode(&got)) {
					assert.Equal(t, options.DryRun, got.DryRun, "the delete options must be passed through")
				}
				return &http.Response{
					StatusCode: tc.response.code,
					Header:     http.Header{"Content-Type": []string{tc.response.contentType}},
					Body:       io.NopCloser(strings.NewReader(tc.response.body)),
					Request:    req,
				}, nil
			})
			dyn, err := dynamic.NewForConfig(&rest.Config{Host: "http://loopback", Transport: rt})
			require.NoError(t, err)

			err = DeleteFolderPreferences(t.Context(), dyn.Resource(dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionResource()), tc.namespace, "f1", options)

			if tc.wantErr == nil {
				require.NoError(t, err)
			} else {
				tc.wantErr(t, err)
			}
			require.Equal(t, tc.wantRequest, requests)
		})
	}
}
