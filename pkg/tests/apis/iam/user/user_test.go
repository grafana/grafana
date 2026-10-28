package user

import (
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingsimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/tests/apiserver"
)

var gvrUsers = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "users",
}

var gvrTeams = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "teams",
}

func TestMain(m *testing.M) {
	apiserver.Run(m)
}

type orgUsers struct {
	apiserver.OrgUsers
	AdminServiceAccount *user.User
}

type testEnvironment struct {
	*apiserver.Environment
	Org1 orgUsers
	OrgB apiserver.OrgUsers
}

func newTestEnvironment(t *testing.T, options apiserver.Options) *testEnvironment {
	t.Helper()
	fixture := &testEnvironment{}
	configure := options.Configure
	options.Configure = func(cfg *setting.Cfg) {
		cfg.RBAC.SingleOrganization = true
		cfg.EnableSearch = true
		cfg.HiddenUsers = map[string]struct{}{}
		apis := []string{string(iamapi.APIUsers)}
		if slices.Contains(options.FeatureFlags, featuremgmt.FlagKubernetesUsersReadApi) {
			apis[0] = string(iamapi.APIUsersReadOnly)
		}
		if slices.Contains(options.FeatureFlags, featuremgmt.FlagKubernetesTeamsApi) {
			apis = append(apis, string(iamapi.APITeams))
		}
		cfg.Raw.Section("iam").Key("api").SetValue(strings.Join(apis, ","))
		if configure != nil {
			configure(cfg)
		}
	}
	options.FeatureFlags = append(options.FeatureFlags, featuremgmt.FlagAppPlatformGrpcClientAuth)
	options.Register = func(env *apiserver.Environment) {
		sql := legacysql.NewDatabaseProvider(env.DB)
		features, err := iamapi.ProvideFeatures(env.Cfg)
		require.NoError(t, err)
		_, err = iamapi.RegisterAPIService(env.Cfg, features, env.ConfigProvider, env.Registrar,
			ssosettingsimpl.ProvideReadOnlyDBService(sql), env.DB, env.AccessControl,
			env.AccessClient, nil, nil, env.Registry, iamapi.ProvideNoopRoleApiInstaller(),
			iamapi.ProvideNoopGlobalRoleApiInstaller(), iamapi.ProvideNoopTeamLBACApiInstaller(),
			env.Tracer, iamapi.ProvideNoopRoleBindingApiInstaller(), nil, nil, legacy.NoopExternalGroupReconciler{},
			env.DualWriter, env.ResourceClient, env.Organizations, env.Users, env.Teams,
			env.RestConfigProvider, resourcepermission.ProvideMappersRegistry(), env.AuthInfoStore, env.RemoteCache, nil)
		require.NoError(t, err)
	}
	fixture.Environment = apiserver.New(t, options)
	fixture.Org1.OrgUsers = fixture.CreateOrgUsers(t, apiserver.OrgUsersArgs{GrafanaAdmin: true})
	other, err := fixture.Organizations.CreateWithMember(fixture.Context(t.Context()), &org.CreateOrgCommand{
		Name: "Other Org.", UserID: fixture.Org1.Admin.Identity.UserID,
	})
	require.NoError(t, err)
	require.NotEqual(t, fixture.Org1.OrgID, other.ID)
	fixture.OrgB = fixture.CreateOrgUsers(t, apiserver.OrgUsersArgs{OrgID: other.ID})
	fixture.Org1.AdminServiceAccount, err = fixture.Users.CreateServiceAccount(fixture.Context(t.Context()), &user.CreateUserCommand{
		OrgID: fixture.Org1.OrgID, Login: "admin-sa", Name: "Admin service account", DefaultOrgRole: string(org.RoleAdmin),
	})
	require.NoError(t, err)
	return fixture
}

func createUser(t *testing.T, env *testEnvironment, name string, role org.RoleType, permissions []resourcepermissions.SetResourcePermissionCommand) apiserver.User {
	t.Helper()
	created := env.CreateUser(t, &user.CreateUserCommand{
		Login: name, Name: name, Email: name + "@example.com", Password: user.Password(name),
		OrgID: env.Org1.OrgID, DefaultOrgRole: string(role),
	})
	env.SetPermissions(t, created, permissions)
	return created
}
