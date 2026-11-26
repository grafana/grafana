package acimpl

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"testing/synctest"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/open-feature/go-sdk/openfeature"
	promtest "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/apiserver"
	apiserveroptions "github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userk8s"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type searchShadowDirectory struct {
	apiserver.DirectRestConfigProvider
	roundTrip func(*contextmodel.ReqContext, *http.Request) (*http.Response, error)
}

func (d searchShadowDirectory) GetDirectRestConfig(c *contextmodel.ReqContext) *rest.Config {
	return &rest.Config{Host: "https://iam.example.test", Transport: &apiserveroptions.RoundTripperFunc{
		Fn: func(req *http.Request) (*http.Response, error) { return d.roundTrip(c, req) },
	}}
}

type searchShadowZanzana struct {
	fakeZanzanaClient
	list func(context.Context, *authzv1.ListRequest) (*authzv1.ListResponse, error)
}

func (z *searchShadowZanzana) List(ctx context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	return z.list(ctx, req)
}

func TestPermissionSearchShadowCloudDirectory(t *testing.T) {
	if !db.IsTestDbSQLite() {
		t.Skip("the local directory test uses SQLite")
	}
	enablePermissionSearchShadow(t)
	sql := db.NewTestStore(t)
	for _, fail := range []bool{false, true} {
		name := "merge migrated grant"
		if fail {
			name = "recover from Zanzana worker panic"
		}
		t.Run(name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.StackID = "42"
			var directoryCall func(*contextmodel.ReqContext, *http.Request) (*http.Response, error)
			dir := searchShadowDirectory{roundTrip: func(c *contextmodel.ReqContext, r *http.Request) (*http.Response, error) {
				return directoryCall(c, r)
			}}
			users := userk8s.NewUserK8sService(log.NewNopLogger(), cfg, dir, tracing.InitializeTracerForTest())
			zanzana := &searchShadowZanzana{}
			resolver := NewZanzanaPermissionResolver(zanzana, users, nil, false)
			synctest.Test(t, func(t *testing.T) {
				const namespace = "stacks-42"
				const idToken, accessToken = "fake-id-token", "fake-access-token"
				requester := &user.SignedInUser{
					OrgID: 1, Namespace: namespace, UserID: 5, UserUID: "caller",
					TeamUIDs: []string{"team"}, ExternalGroups: []string{"group"},
					IDToken: idToken, AccessToken: accessToken,
					Permissions: map[int64]map[string][]string{1: {ac.ActionUsersPermissionsRead: {"users:id:3"}}},
				}
				type requestKey struct{}
				ctx, cancel := context.WithCancel(identity.WithRequester(t.Context(), requester))
				defer cancel()
				ctx = context.WithValue(ctx, requestKey{}, "HTTP request context")
				eval := openfeature.NewEvaluationContext(namespace, map[string]any{"namespace": namespace})
				ctx = openfeature.WithTransactionContext(ctx, eval)
				request := (&http.Request{Method: http.MethodGet}).WithContext(ctx)
				original := &contextmodel.ReqContext{Context: &web.Context{Req: request}, SignedInUser: requester}
				ctx = ctxkey.Set(ctx, original)

				dirCalls, listCalls := make(chan bool, 2), make(chan bool, 2)
				release := make(chan struct{})
				directoryCall = func(c *contextmodel.ReqContext, r *http.Request) (*http.Response, error) {
					actual, err := identity.GetRequester(r.Context())
					assert.NoError(t, err)
					assert.Equal(t, idToken, actual.GetIDToken())
					assert.Equal(t, accessToken, actual.GetAccessToken())
					assert.Equal(t, idToken, c.GetIDToken())
					assert.Equal(t, accessToken, c.GetAccessToken())
					assert.Equal(t, eval, openfeature.TransactionContext(r.Context()))
					assert.False(t, identity.IsServiceIdentity(r.Context()))
					assert.Contains(t, r.URL.Path, "/namespaces/"+namespace+"/searchUsers")
					isShadow := shadow.IsShadow(r.Context())
					dirCalls <- isShadow
					if isShadow {
						<-release
						assert.NoError(t, r.Context().Err())
						assert.Nil(t, r.Context().Value(requestKey{}))
						assert.NotSame(t, original, c)
					}
					body := io.NopCloser(strings.NewReader(`{"hits":[{"internalId":3,"name":"target"}],"totalHits":1}`))
					return &http.Response{StatusCode: http.StatusOK, Body: body, Header: http.Header{"Content-Type": {"application/json"}}}, nil
				}
				zanzana.list = func(ctx context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
					isShadow := shadow.IsShadow(ctx)
					listCalls <- isShadow
					assert.Equal(t, namespace, req.Namespace)
					assert.Equal(t, "user:target", req.Subject)
					assert.Equal(t, isShadow, req.GetOptions().GetSkipcache())
					if isShadow && fail {
						panic("Zanzana worker panic")
					}
					return &authzv1.ListResponse{Items: []string{"migrated-dashboard"}}, nil
				}
				adapter, err := NewLegacyUserPermissionsSearchShadow(nil)
				require.NoError(t, err)
				catalog, actions, cache := legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0)
				loader := legacypermissions.NewLoader(sql, catalog, actions, cache, cfg, &licensing.OSSLicensingService{}, resolver)
				svc := &Service{
					cfg: cfg, store: database.ProvideService(sql), actionResolver: actions, cache: cache,
					log: log.NewNopLogger(), searchShadow: adapter, zanzanaResolver: resolver,
					legacyClient: legacypermissions.NewEmbeddedClient(loader, cfg),
				}
				got, err := svc.SearchUsersPermissions(ctx, requester, ac.SearchOptions{Action: "dashboards:read"})
				cancel()
				close(release)
				require.NoError(t, err)
				require.Equal(t, map[int64][]ac.Permission{3: {{Action: "dashboards:read", Scope: "dashboards:uid:migrated-dashboard"}}}, got)
				synctest.Wait()
				require.Len(t, dirCalls, 2)
				require.False(t, <-dirCalls)
				require.True(t, <-dirCalls)
				require.Len(t, listCalls, 2)
				require.False(t, <-listCalls)
				require.True(t, <-listCalls)
				outcome := shadow.Match
				if fail {
					outcome = shadow.Failed
				}
				require.EqualValues(t, 1, promtest.ToFloat64(adapter.results.WithLabelValues(string(outcome))))
				require.Zero(t, promtest.ToFloat64(adapter.results.WithLabelValues(string(shadow.Mismatch))))
			})
		})
	}
}
