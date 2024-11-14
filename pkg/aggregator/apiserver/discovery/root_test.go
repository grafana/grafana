package discovery

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/emicklei/go-restful/v3"
	"github.com/stretchr/testify/require"
	v2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/discovery/aggregated"

	aggregationv0alpha1api "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
)

func TestRootDiscoveryHandler_Handle(t *testing.T) {
	v1Discovery := metav1.APIGroup{
		Name: aggregationv0alpha1api.SchemeGroupVersion.Group,
		Versions: []metav1.GroupVersionForDiscovery{
			{
				GroupVersion: aggregationv0alpha1api.SchemeGroupVersion.String(),
				Version:      aggregationv0alpha1api.SchemeGroupVersion.Version,
			},
		},
		PreferredVersion: metav1.GroupVersionForDiscovery{
			GroupVersion: aggregationv0alpha1api.SchemeGroupVersion.String(),
			Version:      aggregationv0alpha1api.SchemeGroupVersion.Version,
		},
	}
	fakeGroup := metav1.APIGroup{
		Name: "foo.example.com",
		Versions: []metav1.GroupVersionForDiscovery{
			{
				GroupVersion: "foo.example.com/v1",
				Version:      "v1",
			},
		},
		PreferredVersion: metav1.GroupVersionForDiscovery{
			GroupVersion: "foo.example.com/v1",
			Version:      "v1",
		},
	}
	fakeGroupList := metav1.APIGroupList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "APIGroupList",
			APIVersion: "v1",
		},
		Groups: []metav1.APIGroup{fakeGroup},
	}

	rm := aggregated.NewResourceManager("apis")
	v2GroupVersion := v2.APIVersionDiscovery{
		Version: "v0alpha1",
		Resources: []v2.APIResourceDiscovery{
			{
				Resource: "dataplaneservices",
				ResponseKind: &metav1.GroupVersionKind{
					Group:   "aggregation.grafana.app",
					Version: "v0alpha1",
					Kind:    "DataPlaneService",
				},
				Scope:            v2.ScopeCluster,
				SingularResource: "dataplaneservice",
				Verbs:            []string{"list", "get", "create", "update", "delete", "patch", "watch"},
			},
		},
		Freshness: v2.DiscoveryFreshnessCurrent,
	}
	rm.AddGroupVersion("aggregation.grafana.app", v2GroupVersion)

	v2FakeGroupVersion := v2.APIVersionDiscovery{
		Version: "v1",
		Resources: []v2.APIResourceDiscovery{
			{
				Resource: "foos",
				ResponseKind: &metav1.GroupVersionKind{
					Group:   "foo.example.com",
					Version: "v1",
					Kind:    "Foo",
				},
				Scope:            v2.ScopeNamespace,
				SingularResource: "foo",
				Verbs:            []string{"list"},
			},
		},
		Freshness: v2.DiscoveryFreshnessStale,
	}

	fakeRm := aggregated.NewResourceManager("apis")
	rm.AddGroupVersion("foo.example.com", v2FakeGroupVersion)

	delegationTarget := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Header.Get("Accept") {
		case "application/json":
			err := json.NewEncoder(w).Encode(fakeGroupList)
			require.NoError(t, err)
			return
		case "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json":
			fakeRm.ServeHTTP(w, r)
			return
		default:
			fmt.Printf("Accept: %s\n", r.Header.Get("Accept"))
			http.Error(w, "Bad request", http.StatusBadRequest)
		}
	})

	handler := NewRootDiscoveryHandler(delegationTarget)

	chain := &restful.FilterChain{
		Target: func(req *restful.Request, resp *restful.Response) {
			switch req.Request.URL.Path {
			case "/apis/aggregation.grafana.app/v0alpha1":
				_, err := resp.ResponseWriter.Write([]byte("v0alpha1"))
				require.NoError(t, err)
				return
			case "/apis":
				switch req.Request.Header.Get("Accept") {
				case "application/json":
					err := json.NewEncoder(resp.ResponseWriter).Encode(&metav1.APIGroupList{
						TypeMeta: metav1.TypeMeta{
							Kind:       "APIGroupList",
							APIVersion: "v1",
						},
						Groups: []metav1.APIGroup{v1Discovery},
					})
					require.NoError(t, err)
					return
				case "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json":
					rm.ServeHTTP(resp.ResponseWriter, req.Request)
					return
				default:
					fmt.Printf("Accept: %s\n", req.Request.Header.Get("Accept"))
					http.Error(resp.ResponseWriter, "Bad request", http.StatusBadRequest)
				}

			default:
				http.Error(resp.ResponseWriter, "not found", http.StatusNotFound)
			}
		},
	}

	t.Run("should return the list of API groups in v1 format", func(t *testing.T) {
		req := &restful.Request{
			Request: httptest.NewRequest(http.MethodGet, "/apis", nil),
		}
		req.Request.Header.Set("Accept", "application/json")
		rec := httptest.NewRecorder()
		resp := &restful.Response{
			ResponseWriter: rec,
		}

		handler.Handle(req, resp, chain)
		require.Equal(t, http.StatusOK, resp.StatusCode())
		require.NoError(t, resp.Error())
		require.Equal(t, "application/json", resp.Header().Get("Content-Type"))

		expectedGroupList := metav1.APIGroupList{
			TypeMeta: metav1.TypeMeta{
				Kind:       "APIGroupList",
				APIVersion: "v1",
			},
			Groups: append([]metav1.APIGroup{v1Discovery}, fakeGroupList.Groups...),
		}

		actualGroupList := metav1.APIGroupList{}
		err := json.NewDecoder(rec.Body).Decode(&actualGroupList)
		require.NoError(t, err)

		require.Equal(t, expectedGroupList, actualGroupList)
	})

	t.Run("should return the list of API groups in v2 format", func(t *testing.T) {
		req := &restful.Request{
			Request: httptest.NewRequest(http.MethodGet, "/apis", nil),
		}
		req.Request.Header.Set("Accept", "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json")
		rec := httptest.NewRecorder()
		resp := &restful.Response{
			ResponseWriter: rec,
		}

		handler.Handle(req, resp, chain)
		require.Equal(t, http.StatusOK, resp.StatusCode())
		require.Equal(t, "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList", resp.Header().Get("Content-Type"))

		expected := v2.APIGroupDiscoveryList{
			TypeMeta: metav1.TypeMeta{
				Kind:       "APIGroupDiscoveryList",
				APIVersion: v2.SchemeGroupVersion.String(),
			},
			ListMeta: metav1.ListMeta{},
			Items: []v2.APIGroupDiscovery{
				{
					TypeMeta: metav1.TypeMeta{},
					ObjectMeta: metav1.ObjectMeta{
						Name: "aggregation.grafana.app",
					},
					Versions: []v2.APIVersionDiscovery{v2GroupVersion},
				},
				{
					TypeMeta: metav1.TypeMeta{},
					ObjectMeta: metav1.ObjectMeta{
						Name: "foo.example.com",
					},
					Versions: []v2.APIVersionDiscovery{v2FakeGroupVersion},
				},
			},
		}

		actual := v2.APIGroupDiscoveryList{}
		err := json.NewDecoder(rec.Body).Decode(&actual)
		require.NoError(t, err)

		require.Equal(t, expected, actual)
	})

	t.Run("should handle the request if the path is not /apis", func(t *testing.T) {
		req := &restful.Request{
			Request: httptest.NewRequest(http.MethodGet, "/apis/aggregation.grafana.app/v0alpha1", nil),
		}
		rec := httptest.NewRecorder()
		resp := &restful.Response{
			ResponseWriter: rec,
		}

		handler.Handle(req, resp, chain)
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "v0alpha1", rec.Body.String())
	})
}
