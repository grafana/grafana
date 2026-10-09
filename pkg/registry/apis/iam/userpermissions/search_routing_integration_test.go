package userpermissions_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/userpermissions"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// This service exposes registration data but cannot evaluate permissions locally.
// The production AuthZ provider must supply enumeration directly from its loader.
type iamPermissionRoutingService struct {
	ac.Service
	staticCalls atomic.Int64
	client      ac.UserPermissionsClient
}

func (s *iamPermissionRoutingService) GetStaticRoles(context.Context) map[string]*ac.RoleDTO {
	s.staticCalls.Add(1)
	return nil
}

func (s *iamPermissionRoutingService) SetUserPermissionsClient(client ac.UserPermissionsClient) {
	s.client = client
}

type iamPermissionRoutingClient struct {
	authlib.UserPermissionsClient
	calls atomic.Int64
}

func (c *iamPermissionRoutingClient) GetUserPermissions(ctx context.Context, info authlib.AuthInfo, req authlib.GetUserPermissionsRequest) (authlib.GetUserPermissionsResponse, error) {
	c.calls.Add(1)
	return c.UserPermissionsClient.GetUserPermissions(ctx, info, req)
}

type iamPermissionRoutingSearchStore struct {
	store.SearchPermissionStore
	calls atomic.Int64
}

func (s *iamPermissionRoutingSearchStore) SearchUsersPermissions(ctx context.Context, ns authlib.NamespaceInfo, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	s.calls.Add(1)
	return s.SearchPermissionStore.SearchUsersPermissions(ctx, ns, options)
}

func TestIntegrationIAMUserPermissions_SearchFlagsPreserveRouting(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, search := range []bool{false, true} {
		for _, legacy := range []bool{false, true} {
			t.Run(fmt.Sprintf("search=%t/enumeration=%t", search, legacy), func(t *testing.T) {
				flags := map[string]memprovider.InMemoryFlag{}
				for name, enabled := range map[string]bool{
					featuremgmt.FlagAuthzUserPermissionsSearch: search,
					featuremgmt.FlagAuthzLegacyUserPermissions: legacy,
				} {
					flags[name] = memprovider.InMemoryFlag{State: memprovider.Enabled, Variants: map[string]any{"value": enabled}, DefaultVariant: "value"}
				}
				require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(flags)))
				t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
				cfg := setting.NewCfg()
				cfg.Anonymous.OrgRole = string(org.RoleViewer)
				sql := db.NewTestStore(t)
				features := featuremgmt.WithFeatures()
				tracer := tracing.InitializeTracerForTest()
				catalog := legacypermissions.NewRoleCatalog()
				catalog.Replace(map[string][]ac.Permission{string(org.RoleViewer): {
					{Action: "contract:static", Scope: "contract:*"},
					{Action: "contract:static", Scope: "contract:*"},
					{Action: "contract:unscoped"},
				}})
				searchStore := &iamPermissionRoutingSearchStore{SearchPermissionStore: store.NewSQLPermissionStore(legacysql.NewDatabaseProvider(sql), tracer)}
				loader := legacypermissions.NewLoader(sql, catalog, resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg,
					features, &licensing.OSSLicensingService{}, nil, legacypermissions.WithSearchPermissionStore(searchStore))
				service := &iamPermissionRoutingService{}
				clients, err := authz.ProvideAuthZClients(cfg, features, nil, tracer, prometheus.NewRegistry(), sql, service, nil,
					apiserver.ProvideEventualRestConfigProvider(), nil, loader)
				require.NoError(t, err)
				require.NotNil(t, service.client)
				client := &iamPermissionRoutingClient{UserPermissionsClient: authz.ProvideAuthZUserPermissionsClient(clients)}
				seedIAMPermissionRouting(t, sql)
				identities := map[string]authlib.AuthInfo{
					"alice":           &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "iam-routing-alice", Namespace: "default"},
					"alice-other-org": &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "iam-routing-alice", Namespace: "org-2"},
					"service-account": &identity.StaticRequester{Type: authlib.TypeServiceAccount, UserUID: "iam-routing-service", Namespace: "default"},
					"none":            &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "iam-routing-none", Namespace: "default"},
					"anonymous":       &user.SignedInUser{OrgID: 1, Namespace: "default", IsAnonymous: true},
				}
				handler := userpermissions.NewHandler(client, false)
				route := handler.GetAPIRoutes(nil).Namespace[0]
				mux := http.NewServeMux()
				mux.HandleFunc("GET /apis/iam.grafana.app/v0alpha1/namespaces/{namespace}/"+route.Path, func(w http.ResponseWriter, req *http.Request) {
					ctx := genericapirequest.WithNamespace(req.Context(), req.PathValue("namespace"))
					ctx = openfeature.WithTransactionContext(ctx, openfeature.NewEvaluationContext("iam-permission-routing", nil))
					if info := identities[req.Header.Get("X-Test-Identity")]; info != nil {
						ctx = authlib.WithAuthInfo(ctx, info)
					}
					route.Handler(w, req.WithContext(ctx))
				})
				server := httptest.NewServer(mux)
				t.Cleanup(server.Close)
				shared := iam.UserPermission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}
				basic := []iam.UserPermission{shared, {Action: "contract:static", Scope: "contract:*"}, {Action: "contract:unscoped"}, {Action: "contract:builtin", Scope: "contract:id:builtin"}}
				alice := append(append([]iam.UserPermission{}, basic...), iam.UserPermission{Action: "contract:read", Scope: "contract:id:direct"}, iam.UserPermission{Action: "contract:read", Scope: "contract:id:team"})
				cases := []struct {
					name, identity, namespace string
					status                    int
					permissions               []iam.UserPermission
					callsClient               bool
				}{
					{"user merges direct team static and managed basic grants", "alice", "default", http.StatusOK, alice, true},
					{"warm user request still calls existing enumeration client", "alice", "default", http.StatusOK, alice, true},
					{"service account direct and basic grants", "service-account", "default", http.StatusOK, append(append([]iam.UserPermission{}, basic...), iam.UserPermission{Action: "contract:service", Scope: "contract:*"}), true},
					{"no assigned grants retains shared folder permission", "none", "default", http.StatusOK, []iam.UserPermission{shared}, true},
					{"anonymous uses configured basic role", "anonymous", "default", http.StatusOK, basic, true},
					{"same user is isolated across organizations", "alice-other-org", "org-2", http.StatusOK, []iam.UserPermission{shared, {Action: "contract:foreign", Scope: "contract:id:foreign"}}, true},
					{"namespace mismatch rejected before client", "alice", "org-2", http.StatusForbidden, nil, false},
					{"missing identity rejected before client", "", "default", http.StatusUnauthorized, nil, false},
				}
				for _, tc := range cases {
					t.Run(tc.name, func(t *testing.T) {
						before := client.calls.Load()
						req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, server.URL+"/apis/iam.grafana.app/v0alpha1/namespaces/"+tc.namespace+"/"+route.Path, nil)
						require.NoError(t, err)
						req.Header.Set("X-Test-Identity", tc.identity)
						res, err := server.Client().Do(req)
						require.NoError(t, err)
						defer func() { require.NoError(t, res.Body.Close()) }()
						body, err := io.ReadAll(res.Body)
						require.NoError(t, err)
						require.Equal(t, tc.status, res.StatusCode, string(body))
						if tc.callsClient {
							require.Equal(t, before+1, client.calls.Load())
						} else {
							require.Equal(t, before, client.calls.Load())
						}
						require.Zero(t, searchStore.calls.Load(), "IAM current-user permissions must not invoke search")
						require.Zero(t, service.staticCalls.Load(), "enumeration must use the shared loader, without calling back into Access Control")
						if tc.status == http.StatusOK {
							require.Equal(t, "application/json", res.Header.Get("Content-Type"))
							var got iam.UserPermissions
							require.NoError(t, json.Unmarshal(body, &got))
							require.ElementsMatch(t, tc.permissions, got.Permissions)
						}
					})
				}
			})
		}
	}
}

func seedIAMPermissionRouting(t *testing.T, sql db.DB) {
	t.Helper()
	now := time.Now()
	insert := func(table string, value any) {
		t.Helper()
		require.NoError(t, sql.WithDbSession(t.Context(), func(sess *db.Session) error {
			_, err := sess.Table(table).Insert(value)
			return err
		}))
	}
	insert("org", &org.Org{ID: 2, Name: "iam-routing-other", Created: now, Updated: now})
	for _, usr := range []user.User{
		{ID: 100, UID: "iam-routing-alice", Login: "iam-routing-alice", OrgID: 1},
		{ID: 101, UID: "iam-routing-service", Login: "iam-routing-service", OrgID: 1, IsServiceAccount: true},
		{ID: 102, UID: "iam-routing-none", Login: "iam-routing-none", OrgID: 1},
	} {
		usr.Email = usr.UID + "@example.com"
		usr.Created, usr.Updated = now, now
		insert("user", &usr)
		role := org.RoleViewer
		if usr.ID == 102 {
			role = org.RoleNone
		}
		insert("org_user", &org.OrgUser{OrgID: 1, UserID: usr.ID, Role: role, Created: now, Updated: now})
	}
	insert("org_user", &org.OrgUser{OrgID: 2, UserID: 100, Role: org.RoleNone, Created: now, Updated: now})
	grant := func(id, orgID int64, action, scope string) {
		t.Helper()
		insert("role", &ac.Role{ID: id, OrgID: orgID, UID: fmt.Sprintf("iam-role-%d", id), Name: fmt.Sprintf("managed:iam-role-%d", id), Version: 1, Created: now, Updated: now})
		kind, attr, identifier := ac.SplitScope(scope)
		insert("permission", &ac.Permission{RoleID: id, Action: action, Scope: scope, Kind: kind, Attribute: attr, Identifier: identifier, Created: now, Updated: now})
	}
	grant(100, 1, "contract:read", "contract:id:direct")
	grant(101, 1, "contract:read", "contract:id:team")
	grant(102, 1, "contract:builtin", "contract:id:builtin")
	grant(103, 1, "contract:service", "contract:*")
	grant(104, 2, "contract:foreign", "contract:id:foreign")
	for _, assignment := range []ac.UserRole{
		{OrgID: 1, UserID: 100, RoleID: 100}, {OrgID: 1, UserID: 101, RoleID: 103}, {OrgID: 2, UserID: 100, RoleID: 104},
	} {
		assignment.Created = now
		insert("user_role", &assignment)
	}
	insert("builtin_role", &ac.BuiltinRole{OrgID: 1, RoleID: 102, Role: string(org.RoleViewer), Created: now, Updated: now})
	insert("team", &team.Team{ID: 100, UID: "iam-routing-team", OrgID: 1, Name: "iam-routing-team", Created: now, Updated: now})
	insert("team_role", &ac.TeamRole{OrgID: 1, TeamID: 100, RoleID: 101, Created: now})
	insert("team_member", &team.TeamMember{UID: "iam-routing-member", OrgID: 1, TeamID: 100, UserID: 100, Permission: team.PermissionTypeMember, Created: now, Updated: now})
}
