package legacypermissions

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	authlibv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userk8s"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type searchIAMTransport struct {
	apiserver.DirectRestConfigProvider
	call func(*contextmodel.ReqContext, *http.Request) (*http.Response, error)
}

func (s searchIAMTransport) GetDirectRestConfig(c *contextmodel.ReqContext) *rest.Config {
	return &rest.Config{Host: "https://iam.example.test", Transport: &options.RoundTripperFunc{
		Fn: func(req *http.Request) (*http.Response, error) { return s.call(c, req) },
	}}
}

func TestEmbeddedSearchDirectoryCallerAndZanzanaOnlyGrant(t *testing.T) {
	for _, tc := range []struct {
		name           string
		token          string
		externalGroups []string
	}{
		{"signed token with external groups", "signed-caller-token", []string{"idp-group"}},
		{"signed token without external groups", "signed-caller-token", nil},
		{"missing token", "", []string{"idp-group"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.StackID = "12"
			const namespace = "stacks-12"
			const callerUID = "caller"
			caller := &user.SignedInUser{
				UserID: 42, UserUID: callerUID, OrgID: 1, Namespace: namespace, IDToken: tc.token,
				TeamUIDs: []string{"team-uid"}, ExternalGroups: tc.externalGroups,
				Permissions: map[int64]map[string][]string{1: {ac.ActionUsersPermissionsRead: {"users:id:3"}}},
			}
			ctx := identity.WithRequester(t.Context(), caller)
			ctx = ctxkey.Set(ctx, &contextmodel.ReqContext{Context: &web.Context{}, SignedInUser: caller})
			req := embeddedSearchTestRequest()
			req.Namespace = namespace
			req.Options = ac.SearchOptions{Action: "dashboards:read"}
			req.Requester.Identity.RequesterNamespace = &caller.Namespace
			req.Requester.Identity.Groups = caller.GetGroups()
			req.Requester.ExternalGroups = caller.GetExternalGroups()
			req.Requester.EffectivePermissions = caller.GetPermissions()
			req.Requester.HasDirectoryContext = true
			req.Requester.IAMIDToken = caller.GetIDToken()

			var lookups int
			directory := searchIAMTransport{call: func(c *contextmodel.ReqContext, r *http.Request) (*http.Response, error) {
				lookups++
				require.Contains(t, r.URL.Path, "/namespaces/"+namespace+"/searchUsers")
				actual, err := identity.GetRequester(r.Context())
				require.NoError(t, err)
				require.Equal(t, caller.GetUID(), actual.GetUID())
				require.Equal(t, tc.token, actual.GetIDToken())
				require.Equal(t, tc.token, c.GetIDToken())
				assert.Equal(t, caller.GetGroups(), actual.GetGroups())
				assert.Equal(t, caller.GetExternalGroups(), actual.GetExternalGroups())
				require.Equal(t, caller.GetPermissions(), actual.GetPermissions())
				require.False(t, identity.IsServiceIdentity(r.Context()))
				if actual.GetIDToken() == "" {
					return nil, fmt.Errorf("missing authorization for aggregated request")
				}
				body := io.NopCloser(strings.NewReader(`{"hits":[{"internalId":3,"name":"target"}],"totalHits":1}`))
				return &http.Response{StatusCode: http.StatusOK, Body: body, Header: http.Header{"Content-Type": {"application/json"}}}, nil
			}}
			users := userk8s.NewUserK8sService(log.New("test"), cfg, directory, tracing.InitializeTracerForTest())
			zanzana := NewZanzanaPermissionResolver(&fakeZanzanaClient{
				listResp: &authlibv1.ListResponse{Items: []string{"migrated-dashboard"}},
			}, users, nil, false)
			backend := searchTestStore{search: func(context.Context, int64, ac.SearchOptions) (map[int64][]ac.Permission, error) {
				return nil, nil
			}}
			engine := newSearchTestEngine(backend, zanzana)
			client := NewEmbeddedClient(&Loader{license: &licensing.OSSLicensingService{}, search: engine}, cfg)

			want, err := engine.Search(ctx, caller, req.Options, false)
			require.NoError(t, err)
			got, err := client.LegacySearchUsersPermissions(ctx, LegacySearchPermissionCaller(namespace), req)
			require.NoError(t, err)
			require.Equal(t, want, got.Permissions)
			require.Equal(t, 2, lookups)
			if tc.token != "" {
				require.Equal(t, map[int64][]ac.Permission{
					3: {{Action: "dashboards:read", Scope: "dashboards:uid:migrated-dashboard"}},
				}, got.Permissions)
			} else {
				require.Empty(t, got.Permissions)
			}
		})
	}
}
