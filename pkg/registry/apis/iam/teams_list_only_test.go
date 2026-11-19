package iam

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	restful "github.com/emicklei/go-restful/v3"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	meta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metainternal "k8s.io/apimachinery/pkg/apis/meta/internalversion/scheme"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/util/managedfields"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/endpoints"
	"k8s.io/apiserver/pkg/endpoints/filters"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission"
	"github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	teamservice "github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

type teamListFixture struct{ legacy.LegacyIdentityStore }

func (teamListFixture) ListTeams(context.Context, authlib.NamespaceInfo, legacy.ListTeamQuery) (*legacy.ListTeamResult, error) {
	return &legacy.ListTeamResult{Teams: []teamservice.Team{{UID: "oncall", Name: "On call", Email: "private@example.com", ExternalUID: "external-oncall"}}}, nil
}

func (teamListFixture) ListTeamBindings(context.Context, authlib.NamespaceInfo, legacy.ListTeamBindingsQuery) (*legacy.ListTeamBindingsResult, error) {
	return &legacy.ListTeamBindingsResult{Bindings: []legacy.TeamMember{
		{TeamUID: "oncall", UserUID: "sam", Permission: teamservice.PermissionTypeMember},
		{TeamUID: "oncall", UserUID: "hidden", Permission: teamservice.PermissionTypeMember},
		{TeamUID: "oncall", UserUID: "service", Permission: teamservice.PermissionTypeMember},
	}}, nil
}

func (teamListFixture) ListDisplay(context.Context, authlib.NamespaceInfo, legacy.ListDisplayQuery) (*legacy.ListUserResult, error) {
	return &legacy.ListUserResult{Items: []common.UserWithRole{
		{User: user.User{UID: "sam", Login: "sam"}},
		{User: user.User{UID: "hidden", Login: "hidden-login"}},
		{User: user.User{UID: "service", Login: "service-login", IsServiceAccount: true}},
	}}, nil
}

type rosterSettings struct {
	settingsvc.Service
	t         *testing.T
	namespace string
}

func (s rosterSettings) List(ctx context.Context, selector metav1.LabelSelector) ([]*settingsvc.Setting, error) {
	s.t.Helper()
	require.Equal(s.t, s.namespace, request.NamespaceValue(ctx))
	require.Equal(s.t, map[string]string{"section": "users", "key": "hidden_users"}, selector.MatchLabels)
	return []*settingsvc.Setting{{Section: "users", Key: "hidden_users", Value: "hidden-login"}}, nil
}

func TestStandaloneTeamListOnlyRosterPermissions(t *testing.T) {
	const ns = "stacks-123"
	access := authz.NewClient(nil)
	tracer := tracing.InitializeTracerForTest()
	b := NewAPIService(access, nil, legacysql.NewDatabaseProvider(nil),
		&NoopApiInstaller[*iamv0.RoleBinding]{ResourceInfo: iamv0.RoleBindingInfo},
		&NoopApiInstaller[*iamv0.Role]{ResourceInfo: iamv0.RoleInfo},
		&NoopApiInstaller[*iamv0.GlobalRole]{ResourceInfo: iamv0.GlobalRoleInfo},
		&NoopApiInstaller[*iamv0.TeamLBACRule]{ResourceInfo: iamv0.TeamLBACRuleInfo},
		nil, prometheus.NewRegistry(), nil, nil, tracer, resourcepermission.NewMappersRegistry(), rosterSettings{t: t, namespace: ns},
		Features{TeamsAPI: true, TeamsAPIListOnly: true})
	require.NotNil(t, b.store, "standalone IAM must wire the tenant directory")
	b.store = teamListFixture{}
	b.legacyTeamStore = team.NewLegacyStore(b.store, access, tracer, nil)
	scheme := runtime.NewScheme()
	require.NoError(t, b.InstallSchema(scheme))
	info := &genericapiserver.APIGroupInfo{VersionedResourcesStorageMap: map[string]map[string]rest.Storage{}}
	opts := builder.APIGroupOptions{
		StorageOpts:         &options.StorageOptions{},
		Scheme:              scheme,
		OptsGetter:          appinstaller.NewNoopRESTOptionsGetter(),
		StorageOptsRegister: func(schema.GroupResource, apistore.StorageOptions) {},
		DualWriteBuilder: func(_ schema.GroupResource, legacy, _ grafanarest.Storage) (grafanarest.Storage, error) {
			return legacy, nil
		},
	}
	require.NoError(t, b.UpdateAPIGroupInfo(info, opts))
	stores := info.VersionedResourcesStorageMap["v0alpha1"]
	gv := iamv0.SchemeGroupVersion
	api := endpoints.APIGroupVersion{Storage: stores,
		Root: "/apis", GroupVersion: gv,
		Creater: scheme, Convertor: scheme, UnsafeConvertor: runtime.UnsafeObjectConvertor(scheme),
		Defaulter: scheme, Typer: scheme, Namer: meta.NewAccessor(),
		TypeConverter: managedfields.NewDeducedTypeConverter(), EquivalentResourceRegistry: runtime.NewEquivalentResourceRegistry(),
		Serializer: serializer.NewCodecFactory(scheme), ParameterCodec: metainternal.ParameterCodec, OptionsExternalVersion: &gv,
	}
	routes := restful.NewContainer()
	resources, _, err := api.InstallREST(routes)
	require.NoError(t, err)
	found := false
	for _, resource := range resources {
		if resource.Resource == "teams" {
			found = true
			require.ElementsMatch(t, []string{"list"}, resource.Verbs)
			require.Empty(t, resource.Subresources)
		}
	}
	require.True(t, found, "expected teams in API discovery")
	handler := filters.WithRequestInfo(filters.WithAuthorization(routes, b.GetAuthorizer(), api.Serializer), &request.RequestInfoFactory{APIPrefixes: sets.NewString("apis")})

	caller := func(ctx context.Context, grants ...string) context.Context {
		permissions := make([]string, len(grants))
		for i, grant := range grants {
			permissions[i] = gv.Group + "/" + grant
		}
		return identity.WithRequester(ctx, &identity.StaticRequester{
			Type: authlib.TypeAccessPolicy, Namespace: ns, UserUID: "caller",
			AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Permissions: permissions}},
		})
	}
	for _, tc := range []struct {
		name        string
		permissions []string
		status      int
		wantRoster  bool
	}{
		{"list only", []string{"teams:list"}, 200, false},
		{"team list with membership permission", []string{"teams:list", "teams:get_permissions"}, 200, false},
		{"team and user list", []string{"teams:list", "users:list"}, 200, false},
		{"roster and user permissions", []string{"teams:list", "teams:get_permissions", "users:list"}, 200, true},
		{"users only", []string{"users:list"}, 403, false},
		{"membership only", []string{"teams:get_permissions"}, 403, false},
		{"team wildcard", []string{"teams:*"}, 200, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := caller(t.Context(), tc.permissions...)
			req := httptest.NewRequestWithContext(ctx, http.MethodGet, "/apis/"+gv.String()+"/namespaces/"+ns+"/teams", nil)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			require.Equal(t, tc.status, w.Code, w.Body.String())
			if tc.status != http.StatusOK {
				return
			}
			var list iamv0.TeamList
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
			require.Len(t, list.Items, 1)
			item := list.Items[0]
			require.Equal(t, "On call", item.Spec.Title)
			if tc.wantRoster {
				require.Len(t, item.Spec.Members, 1)
				require.Equal(t, "sam", item.Spec.Members[0].Name)
			} else {
				require.Empty(t, item.Spec.Members)
			}
		})
	}

	t.Run("missing tenant directory", func(t *testing.T) {
		b.store = nil
		info := &genericapiserver.APIGroupInfo{VersionedResourcesStorageMap: map[string]map[string]rest.Storage{}}
		require.NoError(t, b.UpdateAPIGroupInfo(info, opts))
		lister := info.VersionedResourcesStorageMap["v0alpha1"]["teams"].(rest.Lister)
		ctx := request.WithNamespace(caller(t.Context(), "teams:list", "teams:get_permissions", "users:list"), ns)
		obj, err := lister.List(ctx, &internalversion.ListOptions{})
		require.ErrorContains(t, err, "team roster user lookup is unavailable")
		require.Nil(t, obj)
	})
}
