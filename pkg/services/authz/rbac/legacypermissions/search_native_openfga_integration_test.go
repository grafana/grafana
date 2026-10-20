package legacypermissions_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	zclient "github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	zserver "github.com/grafana/grafana/pkg/services/authz/zanzana/server"
	zstore "github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user/userk8s"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type nativeDirectoryConfig struct{ transport http.RoundTripper }

func (p nativeDirectoryConfig) GetDirectRestConfig(req *contextmodel.ReqContext) *rest.Config {
	if req == nil || req.Req == nil || req.SignedInUser == nil || req.GetUID() != "user:401" {
		return nil
	}
	return &rest.Config{Host: "http://native-directory.test", Transport: p.transport}
}

func (nativeDirectoryConfig) DirectlyServeHTTP(http.ResponseWriter, *http.Request) {}
func (nativeDirectoryConfig) IsReady() bool                                        { return true }

type nativeDirectoryTransport struct{}

const hiddenNativeUserID = searchLoaderTargetID + 1

func (nativeDirectoryTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if !identity.IsServiceIdentity(req.Context()) {
		return nil, fmt.Errorf("native searchUsers directory call requires a service identity")
	}
	service, err := identity.GetRequester(req.Context())
	if err != nil || service.GetNamespace() != "default" || service.GetOrgID() != 1 {
		return nil, fmt.Errorf("native searchUsers directory call requires the concrete tenant")
	}
	if !strings.Contains(req.URL.Path, "/namespaces/default/") {
		return nil, fmt.Errorf("native directory used wrong namespace: %s", req.URL.Path)
	}
	var value any
	switch {
	case strings.HasSuffix(req.URL.Path, "/searchUsers"):
		value = iamv0.GetSearchUsersResponse{TotalHits: 2, Hits: []iamv0.GetSearchUsersUserHit{
			{Name: "target-one", InternalId: searchLoaderTargetID},
			{Name: "hidden-one", InternalId: hiddenNativeUserID},
		}}
	case strings.HasSuffix(req.URL.Path, "/users"):
		value = iamv0.UserList{TypeMeta: metav1.TypeMeta{APIVersion: iamv0.GroupVersion.Identifier(), Kind: "UserList"}, Items: []iamv0.User{{
			TypeMeta:   metav1.TypeMeta{APIVersion: iamv0.GroupVersion.Identifier(), Kind: "User"},
			ObjectMeta: metav1.ObjectMeta{Name: "target-one", Namespace: "default", Labels: map[string]string{utils.LabelKeyDeprecatedInternalID: strconv.FormatInt(searchLoaderTargetID, 10)}},
			Spec:       iamv0.UserSpec{Login: "target-one", Role: "Viewer"},
		}}}
	default:
		return nil, fmt.Errorf("unexpected native directory request: %s", req.URL.Path)
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(bytes.NewReader(encoded)), Request: req}, nil
}

type openFGAListClient struct {
	*zclient.NoopClient
	server *zserver.Server
}

func (c openFGAListClient) List(ctx context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	return c.server.List(ctx, req)
}

func TestIntegrationSharedLoaderSearchNativeOpenFGA(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	cfg := loaderConfig(true)
	sql := db.NewTestStore(t)
	seedSearchLoaderUser(t, sql, searchLoaderCallerID, "401", org.RoleNone)
	seedSearchLoaderUser(t, sql, searchLoaderTargetID, "target-one", org.RoleViewer)
	seedSearchLoaderUser(t, sql, hiddenNativeUserID, "hidden-one", org.RoleViewer)
	seedGrant(t, sql, "managed:caller", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersPermissionsRead, Scope: fmt.Sprintf("users:id:%d", searchLoaderTargetID)})
	seedGrant(t, sql, "managed:directory", 1, searchLoaderCallerID, ac.Permission{Action: ac.ActionUsersRead, Scope: "users:*"})

	fgacfg := setting.NewCfg()
	fgasql := sqlstore.NewTestStore(t, sqlstore.WithCfg(fgacfg))
	store, err := zstore.NewEmbeddedStore(fgacfg, fgasql, log.NewNopLogger())
	require.NoError(t, err)
	fgaserver, err := zserver.NewEmbeddedZanzanaServer(fgacfg, store, log.NewNopLogger(), tracing.NewNoopTracerService(), prometheus.NewRegistry(), nil, nil, leaderelection.NewDefaultElector(), nil)
	require.NoError(t, err)
	t.Cleanup(fgaserver.Close)

	roleTuples, err := zanzana.RoleToTuples("native-reader", []*authzextv1.RolePermission{{Action: "dashboards:read", Scope: "dashboards:uid:zanzana-dash"}})
	require.NoError(t, err)
	assignment := common.NewTuple("user:target-one", "assignee", "role:native-reader")
	roleTuples = append(roleTuples, assignment, common.NewTuple("user:hidden-one", "assignee", "role:native-reader"))
	writeCtx := types.WithAuthInfo(t.Context(), authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{
		Namespace: "*", Permissions: []string{zanzana.TokenPermissionUpdate}, DelegatedPermissions: []string{zanzana.TokenPermissionUpdate},
	}}))
	_, err = fgaserver.Write(writeCtx, &authzextv1.WriteRequest{Namespace: "default", Writes: &authzextv1.WriteRequestWrites{TupleKeys: common.ToAuthzExtTupleKeys(roleTuples)}})
	require.NoError(t, err)

	directory := userk8s.NewUserK8sService(log.NewNopLogger(), cfg, nativeDirectoryConfig{transport: nativeDirectoryTransport{}}, tracing.NewNoopTracerService())
	loader := legacypermissions.ProvideLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions), &licensing.OSSLicensingService{}, &openFGAListClient{NoopClient: &zclient.NoopClient{}, server: fgaserver}, nil, directory)
	client := legacypermissions.NewEmbeddedClient(loader, cfg)
	for _, mode := range []string{"targeted", "broad"} {
		t.Run(mode, func(t *testing.T) {
			req := searchLoaderRequest()
			req.Action = "dashboards:read"
			if mode == "broad" {
				req.UserID = 0
			}
			result, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
			require.NoError(t, err)
			require.Contains(t, result.Permissions[searchLoaderTargetID], types.Permission{Action: "dashboards:read", Scope: "dashboards:uid:zanzana-dash"})
			require.NotContains(t, result.Permissions, hiddenNativeUserID)
		})
	}
	_, err = fgaserver.Write(writeCtx, &authzextv1.WriteRequest{Namespace: "default", Deletes: &authzextv1.WriteRequestDeletes{TupleKeys: []*authzextv1.TupleKeyWithoutCondition{{User: assignment.User, Relation: assignment.Relation, Object: assignment.Object}}}})
	require.NoError(t, err)
	req := searchLoaderRequest()
	req.Action = "dashboards:read"
	result, err := client.LegacySearchUsersPermissions(t.Context(), legacypermissions.LegacySearchPermissionCaller("default"), req)
	require.NoError(t, err)
	require.NotContains(t, result.Permissions[searchLoaderTargetID], types.Permission{Action: "dashboards:read", Scope: "dashboards:uid:zanzana-dash"})
}
