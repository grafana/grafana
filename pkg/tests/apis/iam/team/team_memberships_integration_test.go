package team

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

func TestIntegrationGetUserTeamMembershipsByUIDWithoutUsersAPI(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode5} {
		t.Run(fmt.Sprintf("teams dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"teams.iam.grafana.app": {DualWriterMode: mode},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesTeamsApi,
					featuremgmt.FlagKubernetesTeamsRedirect,
				},
			})
			teamSvc := helper.GetEnv().Server.HTTPServer.TeamService

			for _, org := range []apis.OrgUsers{helper.Org1, helper.OrgB} {
				orgID := org.Admin.Identity.GetOrgID()
				namespace := helper.Namespacer(orgID)

				t.Run(fmt.Sprintf("org %d", orgID), func(t *testing.T) {
					usersRsp := apis.DoRequest(helper, apis.RequestParams{
						User:   org.Admin,
						Method: http.MethodGet,
						Path:   fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/users", namespace),
					}, &struct{}{})
					require.Equal(t, http.StatusNotFound, usersRsp.Response.StatusCode, "users API must be disabled")

					userUID := org.Viewer.Identity.GetIdentifier()
					otherUID := org.Editor.Identity.GetIdentifier()
					client := helper.GetResourceClient(apis.ResourceClientArgs{User: org.Admin, Namespace: namespace, GVR: gvrTeams})
					// Team names are unique per org so that reading the wrong namespace can't pass.
					syncedTeam := fmt.Sprintf("synced-team-%d", orgID)
					manualTeam := fmt.Sprintf("manual-team-%d", orgID)
					syncedTeamID := createTeamWithMembers(t, client, syncedTeam,
						teamMember(userUID, iamv0alpha1.TeamTeamPermissionAdmin, true),
						teamMember(otherUID, iamv0alpha1.TeamTeamPermissionMember, true),
					)
					manualTeamID := createTeamWithMembers(t, client, manualTeam, teamMember(userUID, iamv0alpha1.TeamTeamPermissionMember, false))
					createTeamWithMembers(t, client, fmt.Sprintf("unrelated-team-%d", orgID), teamMember(otherUID, iamv0alpha1.TeamTeamPermissionMember, true))

					otherOrg := helper.OrgB
					if orgID == helper.OrgB.Admin.Identity.GetOrgID() {
						otherOrg = helper.Org1
					}
					// The result must not depend on the caller's org or permissions.
					callers := map[string]context.Context{
						"service identity":  serviceContextWithRequest(namespace),
						"org viewer":        userContextWithRequest(t, org.Viewer),
						"other org's admin": userContextWithRequest(t, otherOrg.Admin),
					}
					query := &team.GetUserTeamMembershipsByUIDQuery{OrgID: orgID, UserUID: userUID}

					// Unified search indexes asynchronously, so wait for the new teams to be searchable.
					require.EventuallyWithT(t, func(c *assert.CollectT) {
						got, err := teamSvc.GetUserTeamMembershipsByUID(callers["service identity"], query)
						require.NoError(c, err)
						assert.Len(c, got, 2)
					}, 10*time.Second, 100*time.Millisecond)

					for name, ctx := range callers {
						t.Run(name, func(t *testing.T) {
							got, err := teamSvc.GetUserTeamMembershipsByUID(ctx, query)
							require.NoError(t, err)
							assert.ElementsMatch(t, []team.UserTeamMembership{
								{TeamID: syncedTeamID, TeamUID: syncedTeam, External: true, Permission: team.PermissionTypeAdmin},
								{TeamID: manualTeamID, TeamUID: manualTeam, External: false, Permission: team.PermissionTypeMember},
							}, got)

							external, err := teamSvc.GetUserTeamMembershipsByUID(ctx, &team.GetUserTeamMembershipsByUIDQuery{OrgID: orgID, UserUID: userUID, External: true})
							require.NoError(t, err)
							require.Equal(t, []team.UserTeamMembership{
								{TeamID: syncedTeamID, TeamUID: syncedTeam, External: true, Permission: team.PermissionTypeAdmin},
							}, external)

							// The other org's viewer has no teams in this org.
							otherOrgUser, err := teamSvc.GetUserTeamMembershipsByUID(ctx, &team.GetUserTeamMembershipsByUIDQuery{OrgID: orgID, UserUID: otherOrg.Viewer.Identity.GetIdentifier()})
							require.NoError(t, err)
							require.Empty(t, otherOrgUser)
						})
					}
				})
			}
		})
	}
}

func teamMember(userUID string, permission iamv0alpha1.TeamTeamPermission, external bool) iamv0alpha1.TeamTeamMember {
	return iamv0alpha1.TeamTeamMember{Kind: "User", Name: userUID, Permission: permission, External: external}
}

// createTeamWithMembers returns the created team's deprecated internal ID.
func createTeamWithMembers(t *testing.T, client *apis.K8sResourceClient, name string, members ...iamv0alpha1.TeamTeamMember) int64 {
	t.Helper()
	obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&iamv0alpha1.Team{
		TypeMeta:   metav1.TypeMeta{APIVersion: iamv0alpha1.GroupVersion.Identifier(), Kind: "Team"},
		ObjectMeta: metav1.ObjectMeta{Name: name},
		Spec:       iamv0alpha1.TeamSpec{Title: name, Members: members},
	})
	require.NoError(t, err)
	created, err := client.Resource.Create(context.Background(), &unstructured.Unstructured{Object: obj}, metav1.CreateOptions{})
	require.NoError(t, err)
	meta, err := utils.MetaAccessor(created)
	require.NoError(t, err)
	return meta.GetDeprecatedInternalID() // nolint:staticcheck
}

// serviceContextWithRequest mirrors a login-time caller: a request context is present,
// and the caller acts as a service identity for the user's namespace.
func serviceContextWithRequest(namespace string) context.Context {
	req := httptest.NewRequest(http.MethodPost, "/login", nil)
	ctx := context.WithValue(req.Context(), ctxkey.Key{}, &contextmodel.ReqContext{Context: &web.Context{Req: req}})
	return identity.WithServiceIdentityForSingleNamespaceContext(ctx, namespace)
}

// userContextWithRequest mirrors a per-request caller signed in as u.
func userContextWithRequest(t *testing.T, u apis.User) context.Context {
	t.Helper()
	signedInUser, ok := u.Identity.(*user.SignedInUser)
	require.True(t, ok, "test user identity must be a *user.SignedInUser")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	return context.WithValue(req.Context(), ctxkey.Key{}, &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: signedInUser})
}
