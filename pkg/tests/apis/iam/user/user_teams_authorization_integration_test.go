package user

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Membership rows from users/{uid}/teams are limited to teams the caller can
// read. Permission and external are disclosed only when the caller can read
// permissions on that same team. A continue token is part of the response, so
// it must not name a team the caller cannot read.
func TestIntegrationUserTeamsAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, tc := range []struct {
		name     string
		mode     rest.DualWriterMode
		usersAPI string
	}{
		{name: "legacy store", mode: rest.Mode0, usersAPI: featuremgmt.FlagKubernetesUsersApi},
		{name: "unified store", mode: rest.Mode5, usersAPI: featuremgmt.FlagKubernetesUsersApi},
		{name: "read-only users API", mode: rest.Mode0, usersAPI: featuremgmt.FlagKubernetesUsersReadApi},
	} {
		t.Run(tc.name, func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:      false,
				DisableAnonymous:       true,
				RBACSingleOrganization: true,
				APIServerStorageType:   "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {DualWriterMode: tc.mode},
					"teams.iam.grafana.app": {DualWriterMode: tc.mode},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesTeamsApi,
					tc.usersAPI,
				},
			})
			t.Cleanup(func() { helper.Shutdown() })

			doUserTeamsAuthorizationTests(t, helper, tc.usersAPI == featuremgmt.FlagKubernetesUsersReadApi)
		})
	}
}

type userTeamMembership struct {
	name       string
	internalID int64
}

type userTeamsAuthzItem struct {
	Team           string `json:"team"`
	User           string `json:"user"`
	TeamInternalId *int64 `json:"teamInternalId,omitempty"`
	Permission     string `json:"permission"`
	External       bool   `json:"external"`
}

type userTeamsAuthzResponse struct {
	Metadata struct {
		Continue string `json:"continue"`
	} `json:"metadata"`
	Items []userTeamsAuthzItem `json:"items"`
}

func doUserTeamsAuthorizationTests(t *testing.T, helper *apis.K8sTestHelper, readOnlyUsers bool) {
	t.Helper()
	ctx := context.Background()
	ns := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())

	adminUsers := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin, Namespace: ns, GVR: gvrUsers,
	})
	adminTeams := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin, Namespace: ns, GVR: gvrTeams,
	})

	targetName, targetID := createMembershipTarget(t, ctx, helper, adminUsers, readOnlyUsers)
	// readable sorts before secret, so a page-then-filter bug surfaces the
	// unreadable team on the second page and in the first continue token.
	readable := createTeamWithMember(t, ctx, helper, adminTeams, "team-readable-authz", targetName, "admin", true)
	secret := createTeamWithMember(t, ctx, helper, adminTeams, "team-secret-authz", targetName, "admin", true)

	userRead := userReadGrants(targetName, targetID)
	readableTeam := teamGrants(readable, accesscontrol.ActionTeamsRead)
	secretTeam := teamGrants(secret, accesscontrol.ActionTeamsRead)
	readablePerms := teamGrants(readable, accesscontrol.ActionTeamsRead, accesscontrol.ActionTeamsPermissionsRead)

	usersReader := helper.CreateUser("users-reader-authz", apis.Org1, org.RoleNone, userRead)
	readableReader := helper.CreateUser("readable-reader-authz", apis.Org1, org.RoleNone, append(cloneGrants(userRead), readableTeam...))
	secretReader := helper.CreateUser("secret-reader-authz", apis.Org1, org.RoleNone, append(cloneGrants(userRead), secretTeam...))
	permReader := helper.CreateUser("perm-reader-authz", apis.Org1, org.RoleNone, append(cloneGrants(userRead), readablePerms...))
	noAccess := helper.CreateUser("no-access-authz", apis.Org1, org.RoleNone, nil)

	t.Run("server admin sees permission and external for every membership", func(t *testing.T) {
		got := collectUserTeams(t, helper, helper.Org1.Admin, ns, targetName, 1)
		require.Equal(t, http.StatusOK, got.status, "body: %s", got.body)
		require.ElementsMatch(t, []string{readable.name, secret.name}, teamNames(got.items))
		require.Empty(t, disclosedNames(got.tokens, readable.name, secret.name))
		assertDisclosed(t, itemByTeam(t, got.items, readable.name), targetName, readable, "admin", true)
		assertDisclosed(t, itemByTeam(t, got.items, secret.name), targetName, secret, "admin", true)
	})

	t.Run("caller who cannot read the user is denied and learns nothing", func(t *testing.T) {
		got := collectUserTeams(t, helper, noAccess, ns, targetName, 1)
		require.Equal(t, http.StatusForbidden, got.status, "body: %s", got.body)
		require.NotContains(t, got.body, readable.name)
		require.NotContains(t, got.body, secret.name)
	})

	t.Run("org.users:read does not disclose teams the caller cannot read", func(t *testing.T) {
		requireUserGet(t, helper, usersReader, ns, targetName)
		requireTeamHidden(t, helper, usersReader, ns, readable.name)
		requireTeamHidden(t, helper, usersReader, ns, secret.name)

		got := collectUserTeams(t, helper, usersReader, ns, targetName, 1)
		require.Equal(t, http.StatusOK, got.status, "body: %s", got.body)
		require.Empty(t, got.items, "body: %s", got.body)
		require.Empty(t, got.tokens, "continue token disclosed a team: %v body: %s", got.tokens, got.body)
		require.NotContains(t, got.body, readable.name)
		require.NotContains(t, got.body, secret.name)
	})

	t.Run("teams:read returns only that team and hides permission and external", func(t *testing.T) {
		requireUserGet(t, helper, readableReader, ns, targetName)
		requireTeamGet(t, helper, readableReader, ns, readable.name)
		requireTeamHidden(t, helper, readableReader, ns, secret.name)

		got := collectUserTeams(t, helper, readableReader, ns, targetName, 1)
		require.Equal(t, http.StatusOK, got.status, "body: %s", got.body)
		require.Equal(t, []string{readable.name}, teamNames(got.items), "body: %s", got.body)
		require.False(t, tokensDisclose(got.tokens, secret.name), "continue token named an unreadable team: %v", got.tokens)
		require.NotContains(t, got.body, secret.name)
		assertIdentityOnly(t, itemByTeam(t, got.items, readable.name), targetName, readable)
	})

	t.Run("teams:read on a later team does not disclose the earlier team", func(t *testing.T) {
		requireUserGet(t, helper, secretReader, ns, targetName)
		requireTeamHidden(t, helper, secretReader, ns, readable.name)
		requireTeamGet(t, helper, secretReader, ns, secret.name)

		got := collectUserTeams(t, helper, secretReader, ns, targetName, 1)
		require.Equal(t, http.StatusOK, got.status, "body: %s", got.body)
		require.Equal(t, []string{secret.name}, teamNames(got.items), "body: %s", got.body)
		require.False(t, tokensDisclose(got.tokens, readable.name), "continue token named an unreadable team: %v", got.tokens)
		require.NotContains(t, got.body, readable.name)
		assertIdentityOnly(t, itemByTeam(t, got.items, secret.name), targetName, secret)
	})

	t.Run("teams.permissions:read discloses permission and external for that team only", func(t *testing.T) {
		requireUserGet(t, helper, permReader, ns, targetName)
		requireTeamGet(t, helper, permReader, ns, readable.name)
		requireTeamHidden(t, helper, permReader, ns, secret.name)

		got := collectUserTeams(t, helper, permReader, ns, targetName, 1)
		require.Equal(t, http.StatusOK, got.status, "body: %s", got.body)
		require.Equal(t, []string{readable.name}, teamNames(got.items), "body: %s", got.body)
		require.False(t, tokensDisclose(got.tokens, secret.name), "continue token named an unreadable team: %v", got.tokens)
		require.NotContains(t, got.body, secret.name)
		assertDisclosed(t, itemByTeam(t, got.items, readable.name), targetName, readable, "admin", true)
	})
}

func createMembershipTarget(t *testing.T, ctx context.Context, helper *apis.K8sTestHelper, adminUsers *apis.K8sResourceClient, readOnlyUsers bool) (string, int64) {
	t.Helper()
	if readOnlyUsers {
		created := helper.CreateUser("membership-target", apis.Org1, org.RoleNone, nil)
		id, err := created.Identity.GetInternalID()
		require.NoError(t, err)
		list, err := adminUsers.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		for _, item := range list.Items {
			login, _, _ := unstructured.NestedString(item.Object, "spec", "login")
			if login == "membership-target" {
				return item.GetName(), id
			}
		}
		t.Fatal("read-only users API did not list the legacy user")
	}

	obj := helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml")
	obj.Object["metadata"].(map[string]any)["name"] = "membership-target"
	obj.Object["spec"].(map[string]any)["login"] = "membership-target"
	obj.Object["spec"].(map[string]any)["email"] = "membership-target@example.com"
	created, err := adminUsers.Resource.Create(ctx, obj, metav1.CreateOptions{})
	require.NoError(t, err)
	return created.GetName(), internalID(t, created)
}

func createTeamWithMember(t *testing.T, ctx context.Context, helper *apis.K8sTestHelper, adminTeams *apis.K8sResourceClient, name, userName, permission string, external bool) userTeamMembership {
	t.Helper()
	team := createTeamObject(helper, name, name, name+"@example.com")
	created, err := adminTeams.Resource.Create(ctx, team, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NoError(t, unstructured.SetNestedSlice(created.Object, []any{
		map[string]any{
			"kind":       "User",
			"name":       userName,
			"permission": permission,
			"external":   external,
		},
	}, "spec", "members"))
	_, err = adminTeams.Resource.Update(ctx, created, metav1.UpdateOptions{})
	require.NoError(t, err)
	// The update response omits the internal-id label that create and get carry.
	stored, err := adminTeams.Resource.Get(ctx, name, metav1.GetOptions{})
	require.NoError(t, err)
	return userTeamMembership{name: stored.GetName(), internalID: internalID(t, stored)}
}

func internalID(t *testing.T, obj *unstructured.Unstructured) int64 {
	t.Helper()
	raw := obj.GetLabels()[utils.LabelKeyDeprecatedInternalID]
	require.NotEmpty(t, raw, "resource %s is missing its internal id", obj.GetName())
	id, err := strconv.ParseInt(raw, 10, 64)
	require.NoError(t, err)
	require.Positive(t, id)
	return id
}

func userReadGrants(userName string, internalID int64) []resourcepermissions.SetResourcePermissionCommand {
	return []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{accesscontrol.ActionOrgUsersRead},
			Resource:          "users",
			ResourceAttribute: "id",
			ResourceID:        strconv.FormatInt(internalID, 10),
		},
		{
			Actions:           []string{accesscontrol.ActionOrgUsersRead},
			Resource:          "users",
			ResourceAttribute: "uid",
			ResourceID:        userName,
		},
	}
}

func teamGrants(team userTeamMembership, actions ...string) []resourcepermissions.SetResourcePermissionCommand {
	return []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           actions,
			Resource:          "teams",
			ResourceAttribute: "id",
			ResourceID:        strconv.FormatInt(team.internalID, 10),
		},
		{
			Actions:           actions,
			Resource:          "teams",
			ResourceAttribute: "uid",
			ResourceID:        team.name,
		},
	}
}

func cloneGrants(in []resourcepermissions.SetResourcePermissionCommand) []resourcepermissions.SetResourcePermissionCommand {
	out := make([]resourcepermissions.SetResourcePermissionCommand, len(in))
	copy(out, in)
	return out
}

type collectedUserTeams struct {
	status int
	body   string
	items  []userTeamsAuthzItem
	tokens []string
}

func collectUserTeams(t *testing.T, helper *apis.K8sTestHelper, caller apis.User, namespace, userName string, limit int) collectedUserTeams {
	t.Helper()
	var out collectedUserTeams
	cont := ""
	for page := 0; page < 10; page++ {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/users/%s/teams?limit=%d", namespace, userName, limit)
		if cont != "" {
			path += "&continue=" + url.QueryEscape(cont)
		}
		var res userTeamsAuthzResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   caller,
			Method: http.MethodGet,
			Path:   path,
		}, &res)
		out.body += string(rsp.Body)
		if page == 0 {
			out.status = rsp.Response.StatusCode
		} else {
			require.Equal(t, out.status, rsp.Response.StatusCode, "body: %s", rsp.Body)
		}
		if rsp.Response.StatusCode != http.StatusOK {
			return out
		}
		out.items = append(out.items, res.Items...)
		if res.Metadata.Continue == "" {
			return out
		}
		token, err := resource.GetContinueToken(res.Metadata.Continue)
		require.NoError(t, err)
		out.tokens = append(out.tokens, token.SearchAfter...)
		require.NotEqual(t, cont, res.Metadata.Continue, "pagination did not advance")
		cont = res.Metadata.Continue
	}
	t.Fatal("runaway user teams pagination")
	return out
}

func requireUserGet(t *testing.T, helper *apis.K8sTestHelper, caller apis.User, namespace, userName string) {
	t.Helper()
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   caller,
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/users/%s", namespace, userName),
	}, &map[string]any{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "caller could not read the user, so the teams subresource was not reached: %s", rsp.Body)
}

func requireTeamGet(t *testing.T, helper *apis.K8sTestHelper, caller apis.User, namespace, teamName string) {
	t.Helper()
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   caller,
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/teams/%s", namespace, teamName),
	}, &map[string]any{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "teams:read grant did not authorize this team: %s", rsp.Body)
}

func requireTeamHidden(t *testing.T, helper *apis.K8sTestHelper, caller apis.User, namespace, teamName string) {
	t.Helper()
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   caller,
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/teams/%s", namespace, teamName),
	}, &map[string]any{})
	require.Equal(t, http.StatusForbidden, rsp.Response.StatusCode, "caller can already read team %s through the teams API: %s", teamName, rsp.Body)
}

func assertDisclosed(t *testing.T, item userTeamsAuthzItem, userName string, team userTeamMembership, permission string, external bool) {
	t.Helper()
	require.Equal(t, userName, item.User)
	require.Equal(t, team.name, item.Team)
	require.NotNil(t, item.TeamInternalId)
	require.Equal(t, team.internalID, *item.TeamInternalId)
	require.Equal(t, permission, item.Permission)
	require.Equal(t, external, item.External)
}

func assertIdentityOnly(t *testing.T, item userTeamsAuthzItem, userName string, team userTeamMembership) {
	t.Helper()
	require.Equal(t, userName, item.User)
	require.Equal(t, team.name, item.Team)
	require.NotNil(t, item.TeamInternalId)
	require.Equal(t, team.internalID, *item.TeamInternalId)
	require.Empty(t, item.Permission)
	require.False(t, item.External)
}

func teamNames(items []userTeamsAuthzItem) []string {
	names := make([]string, 0, len(items))
	for _, item := range items {
		names = append(names, item.Team)
	}
	return names
}

func itemByTeam(t *testing.T, items []userTeamsAuthzItem, name string) userTeamsAuthzItem {
	t.Helper()
	for _, item := range items {
		if item.Team == name {
			return item
		}
	}
	t.Fatalf("response did not include team %s: %#v", name, items)
	return userTeamsAuthzItem{}
}

func disclosedNames(tokens []string, allowed ...string) []string {
	ok := map[string]struct{}{}
	for _, name := range allowed {
		ok[name] = struct{}{}
	}
	var out []string
	for _, token := range tokens {
		name := teamNameFromToken(token)
		if _, allowedName := ok[name]; !allowedName {
			out = append(out, token)
		}
	}
	return out
}

func tokensDisclose(tokens []string, name string) bool {
	for _, token := range tokens {
		if teamNameFromToken(token) == name || strings.Contains(token, name) {
			return true
		}
	}
	return false
}

func teamNameFromToken(token string) string {
	if i := strings.LastIndex(token, "/"); i >= 0 {
		return token[i+1:]
	}
	return token
}
