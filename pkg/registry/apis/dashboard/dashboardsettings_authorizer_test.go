package dashboard

import (
	"context"
	"slices"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestDashboardSettingsAuthorizer(t *testing.T) {
	const (
		featureOff     = "dashboard settings feature is not enabled"
		notAvailable   = "dashboard settings are not available to anonymous or render identities"
		lacksGrant     = "calling service lacks required permissions"
		provisioned    = "dashboard settings can't be provisioned"
		tokenWrite     = "access policy tokens can only get, list and delete dashboard settings"
		unsupported    = "not supported for dashboard settings"
		invalidName    = "invalid dashboard settings name"
		mergedReadOnly = "merged dashboard settings are read-only"
		notOrgMember   = "only org members can access org dashboard settings"
		notOrgAdmin    = "only org admins can change org dashboard settings"
		notOwner       = "only the owner can access user dashboard settings"
		noFolderAccess = "folder access denied"
		notFolderAdmin = "only folder admins can change folder dashboard settings"
	)

	accessClient := &dashboardSettingsAccessClient{grants: map[string][]string{
		"f1": {utils.VerbGet},
		"f2": {utils.VerbGet, utils.VerbSetPermissions},
	}}
	authz := newDashboardSettingsAuthorizer(accessClient, grafanaauthorizer.NewServiceAuthorizer())

	viewer := dashboardSettingsRequester(authlib.TypeUser, "viewer", identity.RoleViewer)
	editor := dashboardSettingsRequester(authlib.TypeUser, "editor", identity.RoleEditor)
	admin := dashboardSettingsRequester(authlib.TypeUser, "admin", identity.RoleAdmin)
	serviceAccountAdmin := dashboardSettingsRequester(authlib.TypeServiceAccount, "sa", identity.RoleAdmin)
	apiKeyAdmin := dashboardSettingsRequester(authlib.TypeAPIKey, "key", identity.RoleAdmin)
	serviceAccountU1 := dashboardSettingsRequester(authlib.TypeServiceAccount, "u1", identity.RoleAdmin)
	u1 := dashboardSettingsRequester(authlib.TypeUser, "u1", identity.RoleViewer)
	u2 := dashboardSettingsRequester(authlib.TypeUser, "u2", identity.RoleViewer)
	anonymous := dashboardSettingsRequester(authlib.TypeAnonymous, "", identity.RoleViewer)
	render := dashboardSettingsRequester(authlib.TypeRenderService, "", identity.RoleViewer)
	adminWithoutGrant := dashboardSettingsRequester(authlib.TypeUser, "admin", identity.RoleAdmin)
	adminWithoutGrant.AccessTokenClaims.Rest.DelegatedPermissions = []string{"dashboard.grafana.app/dashboards:*"}
	token := dashboardSettingsToken("dashboard.grafana.app/dashboardsettings:*")
	deleteToken := dashboardSettingsToken("dashboard.grafana.app/dashboardsettings:delete")
	getToken := dashboardSettingsToken("dashboard.grafana.app/dashboardsettings:get")
	// Grafana admins pass the namespace authorizer for every namespace.
	grafanaAdmin := dashboardSettingsRequester(authlib.TypeUser, "admin", identity.RoleAdmin)
	grafanaAdmin.IsGrafanaAdmin = true
	_, service := identity.WithServiceIdentity(context.Background(), 1)
	_, provisioning, err := identity.WithProvisioningIdentity(context.Background(), "stacks-1")
	require.NoError(t, err)

	tests := []struct {
		name       string
		flagOff    bool
		requester  identity.Requester
		namespace  string
		verbs      []string
		resName    string
		wantAllow  bool
		wantReason string
	}{
		{name: "flag off denies a user", flagOff: true, requester: editor, verbs: []string{"get"}, resName: "namespace", wantReason: featureOff},
		// Folder and user cleanup must still find and delete leftovers after the flag is turned off.
		{name: "flag off lets the service identity read and delete", flagOff: true, requester: service, verbs: []string{"get", "list", "watch", "delete", "deletecollection"}, resName: "folder-f1", wantAllow: true},
		{name: "flag off denies service identity writes", flagOff: true, requester: service, verbs: []string{"create", "update", "patch"}, resName: "folder-f1", wantReason: featureOff},
		{name: "flag off denies provisioning writes", flagOff: true, requester: provisioning, verbs: []string{"create", "update"}, resName: "user-u1", wantReason: featureOff},
		{name: "flag off lets an access-policy token delete with its grant", flagOff: true, requester: deleteToken, verbs: []string{"delete"}, resName: "folder-f1", wantAllow: true},
		{name: "flag off still checks the access-policy token's grant", flagOff: true, requester: getToken, verbs: []string{"delete"}, resName: "folder-f1", wantReason: lacksGrant},
		{name: "flag off denies access-policy token writes", flagOff: true, requester: deleteToken, verbs: []string{"create"}, resName: "folder-f1", wantReason: featureOff},

		{name: "anonymous gets nothing", requester: anonymous, verbs: []string{"get"}, resName: "namespace", wantReason: notAvailable},
		{name: "the render service gets nothing, not even merged", requester: render, verbs: []string{"get"}, resName: "merged", wantReason: notAvailable},
		{name: "a token without the dashboardsettings grant is denied", requester: adminWithoutGrant, verbs: []string{"get"}, resName: "namespace", wantReason: lacksGrant},

		{name: "provisioning reads and deletes", requester: provisioning, verbs: []string{"get", "list", "delete"}, resName: "user-u1", wantAllow: true},
		{name: "provisioning can't write", requester: provisioning, verbs: []string{"create", "update", "patch"}, resName: "user-u1", wantReason: provisioned},
		{name: "the service identity writes any tier", requester: service, verbs: []string{"create", "update", "delete"}, resName: "user-u1", wantAllow: true},
		{name: "an access-policy token reads and deletes", requester: token, verbs: []string{"get", "list", "delete"}, resName: "user-u1", wantAllow: true},
		{name: "an access-policy token can't write or watch", requester: token, verbs: []string{"create", "update", "patch", "watch", "deletecollection"}, resName: "user-u1", wantReason: tokenWrite},

		{name: "watch and deletecollection are not supported", requester: admin, verbs: []string{"watch", "deletecollection"}, wantReason: unsupported},
		{name: "the owner can't watch their user tier either", requester: u1, verbs: []string{"watch"}, resName: "user-u1", wantReason: unsupported},
		// The storage wrapper filters a list, and admission authorizes the name a create derives.
		{name: "list and create without a name", requester: viewer, verbs: []string{"list", "create"}, wantAllow: true},
		{name: "other verbs need a name", requester: admin, verbs: []string{"get", "update", "patch", "delete"}, wantReason: invalidName},
		// The merged handler checks folder access itself.
		{name: "get merged", requester: viewer, verbs: []string{"get"}, resName: "merged", wantAllow: true},
		{name: "merged is read-only", requester: admin, verbs: []string{"create", "update", "patch", "delete"}, resName: "merged", wantReason: mergedReadOnly},

		{name: "a viewer reads the org tier", requester: viewer, verbs: []string{"get", "list"}, resName: "namespace", wantAllow: true},
		{name: "an editor can't change the org tier", requester: editor, verbs: []string{"create", "update", "patch", "delete"}, resName: "namespace", wantReason: notOrgAdmin},
		{name: "an admin changes the org tier", requester: admin, verbs: []string{"create", "update", "patch", "delete"}, resName: "namespace", wantAllow: true},
		{name: "a service account admin changes the org tier", requester: serviceAccountAdmin, verbs: []string{"update"}, resName: "namespace", wantAllow: true},
		{name: "an admin API key can't change the org tier", requester: apiKeyAdmin, verbs: []string{"update"}, resName: "namespace", wantReason: notOrgAdmin},
		{name: "another org's tier is denied", requester: admin, namespace: "org-2", verbs: []string{"get", "update"}, resName: "namespace", wantReason: notOrgMember},
		// Org 1's namespace is "default", so "org-1" does not parse.
		{name: "an invalid namespace is denied", requester: admin, namespace: "org-1", verbs: []string{"get"}, resName: "namespace", wantReason: notOrgMember},
		// Every stack's namespace parses to org 1, so only the namespace tells stacks apart.
		{name: "a Grafana admin can't reach another stack's org tier", requester: grafanaAdmin, namespace: "stacks-2", verbs: []string{"get", "update", "delete"}, resName: "namespace", wantReason: notOrgMember},

		{name: "the owner reads and writes their user tier", requester: u1, verbs: []string{"get", "list", "create", "update", "patch", "delete"}, resName: "user-u1", wantAllow: true},
		// A list with a metadata.name field selector reaches the authorizer with that name.
		{name: "another user can't read a user tier", requester: u2, verbs: []string{"get", "list"}, resName: "user-u1", wantReason: notOwner},
		{name: "another user can't write a user tier", requester: u2, verbs: []string{"update", "delete"}, resName: "user-u1", wantReason: notOwner},
		{name: "an admin can't read another user's tier", requester: admin, verbs: []string{"get"}, resName: "user-u1", wantReason: notOwner},
		{name: "a service account with the owner's UID is not the owner", requester: serviceAccountU1, verbs: []string{"get"}, resName: "user-u1", wantReason: notOwner},
		{name: "a Grafana admin can't use their user tier in another stack", requester: grafanaAdmin, namespace: "stacks-2", verbs: []string{"get", "update", "delete"}, resName: "user-admin", wantReason: notOwner},

		{name: "folder read access reads the folder tier", requester: editor, verbs: []string{"get", "list"}, resName: "folder-f1", wantAllow: true},
		{name: "folder read access can't change the folder tier", requester: editor, verbs: []string{"create", "update", "patch", "delete"}, resName: "folder-f1", wantReason: notFolderAdmin},
		{name: "a folder admin changes the folder tier", requester: editor, verbs: []string{"create", "update", "patch", "delete"}, resName: "folder-f2", wantAllow: true},
		{name: "an unknown folder is denied", requester: editor, verbs: []string{"get"}, resName: "folder-nope", wantReason: noFolderAccess},
		{name: "a Grafana admin can't reach another stack's folder tier", requester: grafanaAdmin, namespace: "stacks-2", verbs: []string{"get", "list"}, resName: "folder-f2", wantReason: noFolderAccess},
		{name: "the general folder is not a name", requester: admin, verbs: []string{"get", "list", "create", "update", "patch", "delete"}, resName: "folder-general", wantReason: invalidName},
		{name: "a name outside every tier", requester: admin, verbs: []string{"get", "update"}, resName: "bogus", wantReason: invalidName},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setDashboardSettingsToggle(t, !tt.flagOff)
			ctx := identity.WithRequester(context.Background(), tt.requester)
			for _, verb := range tt.verbs {
				t.Run(verb, func(t *testing.T) {
					attr := dashboardSettingsAuthzAttributes(verb, tt.resName)
					if tt.namespace != "" {
						attr.Namespace = tt.namespace
					}

					decision, reason, err := authz.Authorize(ctx, attr)

					require.NoError(t, err)
					if tt.wantAllow {
						require.Equal(t, authorizer.DecisionAllow, decision)
					} else {
						require.Equal(t, authorizer.DecisionDeny, decision)
					}
					require.Equal(t, tt.wantReason, reason)
				})
			}
		})
	}

	t.Run("a non-resource request has no opinion", func(t *testing.T) {
		decision, _, err := authz.Authorize(identity.WithRequester(context.Background(), admin), authorizer.AttributesRecord{Verb: "get", Path: "/healthz"})

		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionNoOpinion, decision)
	})

	t.Run("a request without a requester is denied", func(t *testing.T) {
		decision, reason, err := authz.Authorize(context.Background(), dashboardSettingsAuthzAttributes("get", "namespace"))

		require.Error(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.Equal(t, "valid user is required", reason)
	})
}

// NoOpinion would fall through to the role authorizer, which lets any Editor write.
func TestDashboardSettingsAuthorizerNeverNoOpinion(t *testing.T) {
	authz := newDashboardSettingsAuthorizer(
		&dashboardSettingsAccessClient{grants: map[string][]string{"f1": {utils.VerbGet}}},
		grafanaauthorizer.NewServiceAuthorizer(),
	)
	_, service := identity.WithServiceIdentity(context.Background(), 1)
	_, provisioning, err := identity.WithProvisioningIdentity(context.Background(), "stacks-1")
	require.NoError(t, err)
	requesters := []struct {
		name      string
		requester identity.Requester
	}{
		{name: "user u1", requester: dashboardSettingsRequester(authlib.TypeUser, "u1", identity.RoleAdmin)},
		{name: "anonymous", requester: dashboardSettingsRequester(authlib.TypeAnonymous, "", identity.RoleViewer)},
		{name: "service identity", requester: service},
		{name: "provisioning identity", requester: provisioning},
		{name: "access-policy token", requester: dashboardSettingsToken("dashboard.grafana.app/dashboardsettings:*")},
	}
	verbs := []string{"get", "list", "watch", "create", "update", "patch", "delete", "deletecollection"}
	names := []string{"", "merged", "namespace", "folder-f1", "user-u1", "user-u2", "bogus"}

	for _, flag := range []struct {
		name    string
		enabled bool
	}{
		{name: "flag on", enabled: true},
		{name: "flag off", enabled: false},
	} {
		t.Run(flag.name, func(t *testing.T) {
			setDashboardSettingsToggle(t, flag.enabled)
			for _, r := range requesters {
				ctx := identity.WithRequester(context.Background(), r.requester)
				for _, verb := range verbs {
					for _, name := range names {
						decision, _, err := authz.Authorize(ctx, dashboardSettingsAuthzAttributes(verb, name))

						require.NoError(t, err, "%s %s %q", r.name, verb, name)
						require.NotEqual(t, authorizer.DecisionNoOpinion, decision, "%s %s %q", r.name, verb, name)
					}
				}
			}
		})
	}
}

func TestDashboardSettingsFolderCheckRequest(t *testing.T) {
	setDashboardSettingsToggle(t, true)
	requester := dashboardSettingsRequester(authlib.TypeUser, "editor", identity.RoleEditor)
	ctx := identity.WithRequester(context.Background(), requester)

	tests := []struct{ verb, wantVerb string }{
		{verb: "get", wantVerb: "get"},
		{verb: "list", wantVerb: "get"},
		{verb: "create", wantVerb: "set_permissions"},
		{verb: "update", wantVerb: "set_permissions"},
		{verb: "patch", wantVerb: "set_permissions"},
		{verb: "delete", wantVerb: "set_permissions"},
	}
	for _, tt := range tests {
		t.Run(tt.verb, func(t *testing.T) {
			accessClient := &dashboardSettingsAccessClient{}
			authz := newDashboardSettingsAuthorizer(accessClient, grafanaauthorizer.NewServiceAuthorizer())

			_, _, err := authz.Authorize(ctx, dashboardSettingsAuthzAttributes(tt.verb, "folder-f1"))

			require.NoError(t, err)
			require.Equal(t, []authlib.CheckRequest{{
				Verb:      tt.wantVerb,
				Group:     "folder.grafana.app",
				Resource:  "folders",
				Namespace: "stacks-1",
				Name:      "f1",
			}}, accessClient.requests)
			require.Equal(t, []string{"f1"}, accessClient.folders)
			// A check made as the service identity would pass on the service's own permissions.
			require.Equal(t, []string{requester.GetUID()}, accessClient.callers)
		})
	}

	t.Run("a requester from another namespace is denied without a check", func(t *testing.T) {
		accessClient := &dashboardSettingsAccessClient{grants: map[string][]string{"f1": {utils.VerbGet}}}
		other := dashboardSettingsRequester(authlib.TypeUser, "editor", identity.RoleEditor)
		other.Namespace = "stacks-2"

		allowed, err := checkDashboardSettingsFolderAccess(context.Background(), accessClient, other, "stacks-1", "f1", utils.VerbGet)

		require.NoError(t, err)
		require.False(t, allowed)
		require.Empty(t, accessClient.requests)
	})

	t.Run("no access client denies", func(t *testing.T) {
		allowed, err := checkDashboardSettingsFolderAccess(context.Background(), nil, requester, "stacks-1", "f1", utils.VerbGet)

		require.NoError(t, err)
		require.False(t, allowed)
	})
}

func TestDashboardsAPIBuilderGetAuthorizerRoutesDashboardSettings(t *testing.T) {
	accessClient := &dashboardSettingsAccessClient{grants: map[string][]string{"f1": {utils.VerbGet}}}
	authz := (&DashboardsAPIBuilder{accessClient: accessClient}).GetAuthorizer()
	ctx := identity.WithRequester(context.Background(), dashboardSettingsRequester(authlib.TypeUser, "editor", identity.RoleEditor))

	t.Run("denies while the feature is off", func(t *testing.T) {
		setDashboardSettingsToggle(t, false)

		decision, reason, err := authz.Authorize(ctx, authzAttributes(dashv2beta1.DashboardSettingsResourceInfo.GetName(), "get"))

		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.Equal(t, "dashboard settings feature is not enabled", reason)
	})

	t.Run("checks folder access with the builder's access client", func(t *testing.T) {
		setDashboardSettingsToggle(t, true)

		decision, reason, err := authz.Authorize(ctx, dashboardSettingsAuthzAttributes("get", "folder-f1"))

		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, decision)
		require.Empty(t, reason)
		require.Equal(t, []string{"f1"}, accessClient.folders)
	})
}

// dashboardSettingsAccessClient grants each folder UID the verbs listed for it and records every check
// and the UID of its caller.
type dashboardSettingsAccessClient struct {
	authlib.AccessClient
	grants        map[string][]string
	callers       []string
	requests      []authlib.CheckRequest
	folders       []string
	batchRequests []authlib.BatchCheckRequest
	// Returned by every batch check in place of an answer.
	batchErr error
	// Fails the item of a batch check that names it, like the RBAC service: the item is not allowed and
	// carries the error, while the other items get their answers.
	batchItemErrs map[string]error
}

func (c *dashboardSettingsAccessClient) Check(_ context.Context, authInfo authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	c.callers = append(c.callers, authInfo.GetUID())
	c.requests = append(c.requests, req)
	c.folders = append(c.folders, folder)
	return authlib.CheckResponse{Allowed: slices.Contains(c.grants[req.Name], req.Verb), Zookie: authlib.NoopZookie{}}, nil
}

// BatchCheck answers each check by its name: FilterAuthorized numbers the checks by position, so the
// correlation IDs say nothing about which folder a check is for.
func (c *dashboardSettingsAccessClient) BatchCheck(_ context.Context, authInfo authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	c.callers = append(c.callers, authInfo.GetUID())
	c.batchRequests = append(c.batchRequests, req)
	if c.batchErr != nil {
		return authlib.BatchCheckResponse{}, c.batchErr
	}
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, check := range req.Checks {
		if err := c.batchItemErrs[check.Name]; err != nil {
			results[check.CorrelationID] = authlib.BatchCheckResult{Error: err}
			continue
		}
		results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: slices.Contains(c.grants[check.Name], check.Verb)}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

// The delegated grant is what a Cloud token needs to reach dashboard settings at all.
func dashboardSettingsRequester(identityType authlib.IdentityType, uid string, role identity.RoleType) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:      identityType,
		UserUID:   uid,
		OrgID:     1,
		OrgRole:   role,
		Namespace: "stacks-1",
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				DelegatedPermissions: []string{"dashboard.grafana.app/dashboardsettings:*"},
			},
		},
	}
}

// dashboardSettingsToken is an access-policy token that is neither Grafana's service identity nor provisioning.
func dashboardSettingsToken(permissions ...string) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:      authlib.TypeAccessPolicy,
		UserUID:   "other-service",
		OrgID:     1,
		Namespace: "stacks-1",
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{Permissions: permissions},
		},
	}
}

func dashboardSettingsAuthzAttributes(verb, name string) authorizer.AttributesRecord {
	attr := authzAttributes(dashv2beta1.DashboardSettingsResourceInfo.GetName(), verb).(authorizer.AttributesRecord)
	attr.Name = name
	return attr
}

func setDashboardSettingsToggle(t *testing.T, enabled bool) {
	t.Helper()
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagGrafanaDashboardSettings: {
			Key:            featuremgmt.FlagGrafanaDashboardSettings,
			DefaultVariant: variant,
			Variants: map[string]any{
				"enabled":  true,
				"disabled": false,
			},
		},
	})))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}
