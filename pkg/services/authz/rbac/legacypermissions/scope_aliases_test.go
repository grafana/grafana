package legacypermissions_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	zclient "github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

type aliasIAMConfig string

func (p aliasIAMConfig) GetRestConfig(context.Context) (*clientrest.Config, error) {
	return &clientrest.Config{Host: string(p)}, nil
}

type aliasGrantClient struct{ zclient.NoopClient }

func (*aliasGrantClient) GetUserPermissions(context.Context, types.AuthInfo, types.GetUserPermissionsRequest) (types.GetUserPermissionsResponse, error) {
	return types.GetUserPermissionsResponse{Permissions: []types.Permission{
		{Action: "teams:read", Scope: "teams:uid:platform"},
		{Action: "users:read", Scope: "global.users:uid:bob"},
		{Action: "org.users:read", Scope: "users:uid:bob"},
		{Action: "serviceaccounts:read", Scope: "serviceaccounts:uid:robot"},
	}}, nil
}

func TestSharedLoaderAddsAliasesAfterMergingBothSources(t *testing.T) {
	var mu sync.Mutex
	calls := map[string]int{}
	object := func(kind, name, id string) map[string]any {
		return map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": kind, "metadata": map[string]any{"name": name, "namespace": "default", "labels": map[string]string{utils.LabelKeyDeprecatedInternalID: id}}}
	}
	iam := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		calls[r.URL.Path]++
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		var result any
		switch {
		case strings.HasSuffix(r.URL.Path, "/teams"):
			require.Equal(t, utils.LabelKeyDeprecatedInternalID+"=42", r.URL.Query().Get("labelSelector"))
			result = map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": "TeamList", "items": []any{object("Team", "platform", "42")}}
		case strings.HasSuffix(r.URL.Path, "/users/bob"):
			result = object("User", "bob", "8")
		case strings.HasSuffix(r.URL.Path, "/serviceaccounts/robot"):
			result = object("ServiceAccount", "robot", "9")
		default:
			http.NotFound(w, r)
			return
		}
		require.NoError(t, json.NewEncoder(w).Encode(result))
	}))
	t.Cleanup(iam.Close)
	sql := db.NewTestStore(t)
	seedGrant(t, sql, "managed:team-reader", 1, 7, ac.Permission{Action: "teams:read", Scope: "teams:id:42"})
	loader := legacypermissions.ProvideLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), loaderConfig(true), featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions), &enforcementLicense{enabled: true}, &aliasGrantClient{}, aliasIAMConfig(iam.URL))
	requester := &user.SignedInUser{UserID: 7, UserUID: "alice", OrgID: 1, Namespace: "default"}
	for range 2 {
		got, err := loader.GetUserPermissions(t.Context(), requester, ac.Options{})
		require.NoError(t, err)
		pairs := map[[2]string]bool{}
		for _, p := range got {
			key := [2]string{p.Action, p.Scope}
			require.False(t, pairs[key], "duplicate scope alias")
			pairs[key] = true
		}
		for _, p := range [][2]string{
			{"teams:read", "teams:id:42"}, {"teams:read", "teams:uid:platform"},
			{"users:read", "global.users:id:8"}, {"users:read", "global.users:uid:bob"},
			{"org.users:read", "users:id:8"}, {"org.users:read", "users:uid:bob"},
			{"serviceaccounts:read", "serviceaccounts:id:9"}, {"serviceaccounts:read", "serviceaccounts:uid:robot"},
		} {
			require.True(t, pairs[p], p)
		}
	}
	mu.Lock()
	defer mu.Unlock()
	base := "/apis/iam.grafana.app/v0alpha1/namespaces/default"
	require.Equal(t, map[string]int{base + "/teams": 1, base + "/users/bob": 1, base + "/serviceaccounts/robot": 1}, calls)
}
