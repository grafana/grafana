package sql

import (
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	"context"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestResourceServerEmbeddedSearch(t *testing.T) {
	for _, blobURL := range []string{"", "mem://"} {
		t.Run("blob_url="+blobURL, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.EnableSearch = true
			cfg.IndexPath = t.TempDir()
			cfg.Raw.Section("grafana-apiserver").Key("blob_url").SetValue(blobURL)
			reg := prometheus.NewPedanticRegistry()
			storage, err := resource.NewKVStorageBackend(resource.KVBackendOptions{
				KvStore: newTestKV(t),
			})
			require.NoError(t, err)
			t.Cleanup(func() {
				ctx, cancel := context.WithTimeout(context.WithoutCancel(t.Context()), 10*time.Second)
				defer cancel()
				require.NoError(t, storage.Stop(ctx))
			})
			searchOptions, err := search.NewSearchOptions(cfg, &searchmodel.TestDocumentBuilderSupplier{
				GroupsResources: map[string]string{"test.grafana.app": "testresources"},
			}, nil, nil, nil)
			require.NoError(t, err)
			t.Cleanup(searchOptions.Backend.Stop)

			server, err := NewUninitializedResourceServer(ServerOptions{
				Cfg:           cfg,
				Backend:       storage,
				SearchOptions: searchOptions,
				Reg:           reg,
			})
			require.NoError(t, err)
			require.NoError(t, server.Init(t.Context()))
			t.Cleanup(func() {
				ctx, cancel := context.WithTimeout(context.WithoutCancel(t.Context()), 10*time.Second)
				defer cancel()
				require.NoError(t, server.Stop(ctx))
			})

			ctx := claims.WithAuthInfo(t.Context(), &identity.StaticRequester{
				Type: claims.TypeUser, Namespace: "test-ns", UserUID: "test-user", OrgRole: identity.RoleAdmin,
			})
			searchReq := &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
					Namespace: "test-ns", Group: "test.grafana.app", Resource: "testresources",
				}},
				Limit: 10,
			}
			response, err := server.SearchHandler().Search(ctx, searchReq)
			require.NoError(t, err)
			require.Nil(t, response.Error)
			require.Zero(t, response.TotalHits)

			for i, name := range []string{"first", "second"} {
				obj := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "test.grafana.app/v1",
					"kind":       "TestResource",
					"metadata":   map[string]any{"name": name, "namespace": "test-ns"},
					"spec":       map[string]any{"title": name},
				}}
				value, err := obj.MarshalJSON()
				require.NoError(t, err)
				created, err := server.StorageHandler().Create(ctx, &resourcepb.CreateRequest{
					Key: &resourcepb.ResourceKey{
						Namespace: "test-ns", Group: "test.grafana.app", Resource: "testresources", Name: name,
					},
					Value: value,
				})
				require.NoError(t, err)
				require.Nil(t, created.Error)

				response, err = server.SearchHandler().Search(ctx, searchReq)
				require.NoError(t, err)
				require.Nil(t, response.Error)
				require.EqualValues(t, i+1, response.TotalHits)
				require.GreaterOrEqual(t, response.ResourceVersion, created.ResourceVersion)
			}

			families, err := reg.Gather()
			require.NoError(t, err)
			if blobURL != "" {
				found := false
				for _, family := range families {
					if family.GetName() == "grafana_cdk_blobstorage_latency_seconds" {
						found = true
					}
				}
				require.True(t, found, "the shared blob backend must expose its metrics")
			}
		})
	}
}
