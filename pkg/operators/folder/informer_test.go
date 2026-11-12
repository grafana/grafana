package folder

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	storagev0 "github.com/grafana/grafana/pkg/apis/storage/v0alpha1"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestStampResourceVersion(t *testing.T) {
	obj := func() runtime.Object {
		return &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: "stacks-1", Name: "a"}}
	}

	stamped := stampResourceVersion(obj(), &resourcepb.WatchNotification{ResourceVersion: 2118421378851557376})
	require.Equal(t, "2118421378851557376", stamped.(*foldersv1.Folder).ResourceVersion)

	unversioned := stampResourceVersion(obj(), &resourcepb.WatchNotification{})
	require.Empty(t, unversioned.(*foldersv1.Folder).ResourceVersion, "an event without a version must stay unversioned so it is always enqueued")
}

func TestListFolderKeys(t *testing.T) {
	first := storagev0.ListKeyItem{Namespace: "stacks-1", Name: "a", ResourceVersion: "10", Folder: "parent"}
	second := storagev0.ListKeyItem{Namespace: "stacks-2", Name: "b", ResourceVersion: "20"}

	for _, tc := range []struct {
		name       string
		items      [][]storagev0.ListKeyItem
		failSecond bool
	}{
		{name: "single page", items: [][]storagev0.ListKeyItem{{first}}},
		{name: "multiple pages and namespaces", items: [][]storagev0.ListKeyItem{{first}, {second}}},
		{name: "empty snapshot", items: [][]storagev0.ListKeyItem{{}}},
		{name: "later page failure discards the snapshot", items: [][]storagev0.ListKeyItem{{first}, {second}}, failSecond: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var tokens []string
			api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.URL.Path == "/token" {
					_, _ = io.WriteString(w, `{"data":{"token":"test-access-token"}}`)
					return
				}
				assert.Equal(t, http.MethodPost, r.Method)
				assert.Equal(t, "/apis/folder.grafana.app/v1/folders/list-keys", r.URL.Path)
				assert.Equal(t, "Bearer test-access-token", r.Header.Get("X-Access-Token"))

				var opts storagev0.ListKeyRequest
				if err := json.NewDecoder(r.Body).Decode(&opts); !assert.NoError(t, err) {
					w.WriteHeader(http.StatusBadRequest)
					return
				}
				tokens = append(tokens, opts.Continue)
				assert.Equal(t, int64(keysapi.DefaultPageSize), opts.Limit)
				page := 0
				if opts.Continue != "" {
					assert.Equal(t, "page2", opts.Continue)
					page = 1
				}
				if page == 1 && tc.failSecond {
					w.WriteHeader(http.StatusServiceUnavailable)
					_ = json.NewEncoder(w).Encode(metav1.Status{
						Status: metav1.StatusFailure, Code: http.StatusServiceUnavailable, Reason: metav1.StatusReasonServiceUnavailable,
					})
					return
				}
				resp := storagev0.ListKeyResponse{
					TypeMeta:        metav1.TypeMeta{APIVersion: storagev0.APIVERSION, Kind: storagev0.KindListKeyResponse},
					ResourceVersion: "100",
					Items:           tc.items[page],
				}
				if page+1 < len(tc.items) {
					resp.Continue = "page2"
				}
				assert.NoError(t, json.NewEncoder(w).Encode(resp))
			}))
			t.Cleanup(api.Close)
			cfg := setting.NewCfg()
			cfg.SectionWithEnvOverrides("operator").Key("folders_server_url").SetValue(api.URL)
			cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token").SetValue("test-token")
			cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token_exchange_url").SetValue(api.URL + "/token")
			client, err := buildRESTClient(cfg, "folders_server_url", folderGVR.Group)
			require.NoError(t, err)

			objs, listRV, err := listFolderKeys(t.Context(), keysapi.NewHTTPLister(client, folderGVR))
			if len(tc.items) == 1 {
				require.Equal(t, []string{""}, tokens)
			} else {
				require.Equal(t, []string{"", "page2"}, tokens)
			}
			if tc.failSecond {
				require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
				require.Nil(t, objs)
				require.Zero(t, listRV)
				return
			}
			require.NoError(t, err)
			require.Equal(t, int64(100), listRV)
			var want []runtime.Object
			for _, page := range tc.items {
				for _, item := range page {
					want = append(want, &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{
						Namespace: item.Namespace, Name: item.Name, ResourceVersion: item.ResourceVersion,
					}})
				}
			}
			require.Equal(t, want, objs)
		})
	}
}
