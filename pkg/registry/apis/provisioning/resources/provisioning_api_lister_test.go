package resources

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// serveResources stands up the repository resources subresource, answering each request with the
// status and body the handler returns, and records the URIs it was asked for.
func serveResources(t *testing.T, handler func(*http.Request) (int, any)) (*ResourceListerFromProvisioningAPI, *[]string) {
	t.Helper()
	var paths []string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.Method+" "+r.URL.RequestURI())
		code, body := handler(r)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		require.NoError(t, json.NewEncoder(w).Encode(body))
	}))
	t.Cleanup(srv.Close)

	scheme := runtime.NewScheme()
	require.NoError(t, provisioning.AddToScheme(scheme))
	metav1.AddToGroupVersion(scheme, schema.GroupVersion{Version: "v1"})
	gv := schema.GroupVersion{Group: provisioning.GROUP, Version: provisioning.VERSION}
	client, err := rest.RESTClientFor(&rest.Config{
		Host:    srv.URL,
		APIPath: "/apis",
		ContentConfig: rest.ContentConfig{
			GroupVersion:         &gv,
			NegotiatedSerializer: serializer.NewCodecFactory(scheme).WithoutConversion(),
		},
	})
	require.NoError(t, err)

	return NewResourceListerFromProvisioningAPI(client), &paths
}

func TestResourceListerFromProvisioningAPI_List(t *testing.T) {
	items := []provisioning.ResourceListItem{
		{Path: "dashboard.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "db-1", Hash: "abc", Title: "Dashboard 1"},
		{Path: "nested/", Group: "folder.grafana.app", Resource: "folders", Name: "fld-1"},
	}
	lister, paths := serveResources(t, func(*http.Request) (int, any) {
		return http.StatusOK, &provisioning.ResourceList{
			TypeMeta: metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "ResourceList"},
			Items:    items,
		}
	})

	got, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{})
	require.NoError(t, err)
	require.Equal(t, items, got.Items)
	require.Equal(t, []string{"GET /apis/provisioning.grafana.app/v0alpha1/namespaces/stacks-1/repositories/repo-1/resources"}, *paths)
}

func TestResourceListerFromProvisioningAPI_ListPage(t *testing.T) {
	lister, paths := serveResources(t, func(*http.Request) (int, any) {
		return http.StatusOK, &provisioning.ResourceList{
			TypeMeta: metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: "ResourceList"},
			ListMeta: metav1.ListMeta{Continue: "next-page"},
			Items:    []provisioning.ResourceListItem{{Path: "dashboard.json", Name: "db-1"}},
		}
	})

	got, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{Limit: 1, Continue: "here"})
	require.NoError(t, err)
	require.Equal(t, "next-page", got.Continue, "the token the caller resumes from must survive")
	require.Equal(t, []string{
		"GET /apis/provisioning.grafana.app/v0alpha1/namespaces/stacks-1/repositories/repo-1/resources?continue=here&limit=1",
	}, *paths)
}

func TestResourceListerFromProvisioningAPI_ListWithoutRepository(t *testing.T) {
	lister, paths := serveResources(t, func(*http.Request) (int, any) {
		return http.StatusOK, &provisioning.ResourceList{}
	})

	_, err := lister.List(t.Context(), "stacks-1", "", ListOptions{})
	require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	require.Empty(t, *paths, "a name the route requires must not be sent as an empty path segment")
}

// The route's callers translate what the lister returns through StatusErrorFromGRPC, which is
// written for the gRPC reader. An already-typed status has to come out the other side unchanged.
// statusTypeMeta is what an apiserver stamps on an error body; without it the client cannot tell
// the body is a Status and falls back to a message of its own.
var statusTypeMeta = metav1.TypeMeta{Kind: "Status", APIVersion: "v1"}

func TestResourceListerFromProvisioningAPI_ListErrorsSurviveTranslation(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status *metav1.Status
		assert func(error) bool
	}{
		{"not found", &metav1.Status{TypeMeta: statusTypeMeta, Status: metav1.StatusFailure, Code: http.StatusNotFound, Reason: metav1.StatusReasonNotFound, Message: `repositories "repo-1" not found`}, apierrors.IsNotFound},
		{"forbidden", &metav1.Status{TypeMeta: statusTypeMeta, Status: metav1.StatusFailure, Code: http.StatusForbidden, Reason: metav1.StatusReasonForbidden, Message: "no access"}, apierrors.IsForbidden},
		{"unavailable", &metav1.Status{TypeMeta: statusTypeMeta, Status: metav1.StatusFailure, Code: http.StatusServiceUnavailable, Reason: metav1.StatusReasonServiceUnavailable, Message: "try later"}, apierrors.IsServiceUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			lister, _ := serveResources(t, func(*http.Request) (int, any) {
				return int(tc.status.Code), tc.status
			})

			_, err := lister.List(t.Context(), "stacks-1", "repo-1", ListOptions{})
			require.True(t, tc.assert(err), "reader returned %v", err)

			translated := resource.StatusErrorFromGRPC(err)
			require.True(t, tc.assert(translated), "translation returned %v", translated)
			require.Equal(t, tc.status.Message, translated.(apierrors.APIStatus).Status().Message)
		})
	}
}

func TestResourceListerFromProvisioningAPI_StatsIsNotImplemented(t *testing.T) {
	lister, paths := serveResources(t, func(*http.Request) (int, any) {
		return http.StatusOK, &provisioning.ResourceStats{}
	})

	_, nsErr := lister.Stats(t.Context(), "stacks-1")
	require.EqualError(t, nsErr, `[provisioning] resource_lister "apis" cannot read stats yet`)

	_, repoErr := lister.RepositoryStats(t.Context(), "stacks-1", "repo-1")
	require.EqualError(t, repoErr, `[provisioning] resource_lister "apis" cannot read stats yet`)

	require.Empty(t, *paths, "neither counts route is read yet")
}
