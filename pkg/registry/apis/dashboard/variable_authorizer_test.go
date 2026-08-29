package dashboard

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
)

func TestVariableAuthorizer(t *testing.T) {
	setGlobalVariablesToggle(t, true)
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	authz := newVariableAuthorizer(ac)
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)
	folderAScope := folder.ScopeFoldersProvider.GetResourceScopeUID("folder-a")

	tests := []struct {
		name      string
		verb      string
		resName   string
		perms     map[string][]string
		wantAllow bool
	}{
		{
			name:      "viewer with root read can list",
			verb:      "list",
			perms:     map[string][]string{ActionVariablesRead: {generalScope}},
			wantAllow: true,
		},
		{
			name:      "viewer without read cannot list",
			verb:      "list",
			perms:     map[string][]string{},
			wantAllow: false,
		},
		{
			name:      "editor with root create can create",
			verb:      "create",
			perms:     map[string][]string{ActionVariablesCreate: {generalScope}},
			wantAllow: true,
		},
		{
			name:      "viewer with folder create can create (coarse)",
			verb:      "create",
			perms:     map[string][]string{ActionVariablesCreate: {folderAScope}},
			wantAllow: true,
		},
		{
			name:      "viewer without create cannot create",
			verb:      "create",
			perms:     map[string][]string{ActionVariablesRead: {generalScope}},
			wantAllow: false,
		},
		{
			name:      "write allowed with variable uid scope",
			verb:      "update",
			resName:   "region",
			perms:     map[string][]string{ActionVariablesWrite: {ScopeVariablesProvider.GetResourceScopeUID("region")}},
			wantAllow: true,
		},
		{
			name:      "root write can update folder-scoped variable (coarse; admission narrows)",
			verb:      "update",
			resName:   "region--folder-a",
			perms:     map[string][]string{ActionVariablesWrite: {generalScope}},
			wantAllow: true,
		},
		{
			name:      "delete denied without action",
			verb:      "delete",
			resName:   "region--folder-a",
			perms:     map[string][]string{ActionVariablesRead: {folderAScope}},
			wantAllow: false,
		},
		{
			name:      "delete allowed with variable uid scope",
			verb:      "delete",
			resName:   "region--folder-a",
			perms:     map[string][]string{ActionVariablesDelete: {ScopeVariablesProvider.GetResourceScopeUID("region--folder-a")}},
			wantAllow: true,
		},
		{
			name:      "root delete can delete folder-scoped variable (coarse; admission narrows)",
			verb:      "delete",
			resName:   "region--missing-folder",
			perms:     map[string][]string{ActionVariablesDelete: {generalScope}},
			wantAllow: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: tc.perms,
				},
			})
			decision, _, err := authz.Authorize(ctx, authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            tc.verb,
				APIGroup:        "dashboard.grafana.app",
				Resource:        "variables",
				Name:            tc.resName,
			})
			require.NoError(t, err)
			if tc.wantAllow {
				require.Equal(t, authorizer.DecisionAllow, decision)
			} else {
				require.Equal(t, authorizer.DecisionDeny, decision)
			}
		})
	}
}

func TestVariableAuthorizer_NilAccessControl(t *testing.T) {
	setGlobalVariablesToggle(t, true)
	authz := newVariableAuthorizer(nil)
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1})

	decision, reason, err := authz.Authorize(ctx, authorizer.AttributesRecord{
		ResourceRequest: true,
		Verb:            "list",
		APIGroup:        "dashboard.grafana.app",
		Resource:        "variables",
	})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "access control is not configured", reason)
}

func TestVariableAuthorizer_CoarseUpdateDoesNotResolveParentFolder(t *testing.T) {
	// Mutations are any-scope; a missing parent must not fail the authorizer.
	// Admission applies the folder-scoped variables:* check.
	setGlobalVariablesToggle(t, true)
	acSvc := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	folderSvc := foldertest.NewFakeService()
	folderSvc.ExpectedError = folder.ErrFolderNotFound
	prefix, resolver := VariableUIDScopeResolver(folderSvc)
	acSvc.RegisterScopeAttributeResolver(prefix, resolver)

	authz := newVariableAuthorizer(acSvc)
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {ActionVariablesWrite: {generalScope}},
		},
	})
	decision, _, err := authz.Authorize(ctx, authorizer.AttributesRecord{
		ResourceRequest: true,
		Verb:            "update",
		APIGroup:        "dashboard.grafana.app",
		Resource:        "variables",
		Name:            "region--missing-folder",
	})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionAllow, decision)
}

func TestFolderUIDFromVariableMetadataName(t *testing.T) {
	require.Equal(t, accesscontrol.GeneralFolderUID, folderUIDFromVariableMetadataName("region"))
	require.Equal(t, "folder-a", folderUIDFromVariableMetadataName("region--folder-a"))
	// Folder UIDs may contain "--"; split on the first separator (spec names are \w+).
	require.Equal(t, "var--abc", folderUIDFromVariableMetadataName("my--var--abc"))
	require.Equal(t, "team--prod", folderUIDFromVariableMetadataName("region--team--prod"))
}

func TestVariableFolderScope(t *testing.T) {
	require.Equal(t, folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID), variableFolderScope(""))
	require.Equal(t, folder.ScopeFoldersProvider.GetResourceScopeUID("folder-a"), variableFolderScope("folder-a"))
}

func setGlobalVariablesToggle(t *testing.T, enabled bool) {
	t.Helper()
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagGrafanaDashboardGlobalVariables: {
			Key:            featuremgmt.FlagGrafanaDashboardGlobalVariables,
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

// TestDashboardsAPIBuilderVariableAuthorizer verifies that the global variables
// feature is gated per request in the authorizer when storage is registered.
func TestDashboardsAPIBuilderVariableAuthorizer(t *testing.T) {
	ctx := context.Background()
	authz := (&DashboardsAPIBuilder{
		accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
	}).GetAuthorizer()

	t.Run("denies variable requests for every verb when disabled", func(t *testing.T) {
		setGlobalVariablesToggle(t, false)
		for _, verb := range []string{"get", "list", "watch", "create", "update", "delete", "deletecollection"} {
			t.Run(verb, func(t *testing.T) {
				decision, reason, err := authz.Authorize(ctx, authzAttributes(dashv2beta1.VariableResourceInfo.GetName(), verb))
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionDeny, decision)
				require.Equal(t, "global dashboard variables feature is not enabled", reason)
			})
		}
	})

	t.Run("denies user requests when disabled even with a requester", func(t *testing.T) {
		setGlobalVariablesToggle(t, false)
		userCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1})
		for _, verb := range []string{"get", "list", "watch", "create", "update", "delete", "deletecollection"} {
			t.Run(verb, func(t *testing.T) {
				decision, reason, err := authz.Authorize(userCtx, authzAttributes(dashv2beta1.VariableResourceInfo.GetName(), verb))
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionDeny, decision)
				require.Equal(t, "global dashboard variables feature is not enabled", reason)
			})
		}
	})

	t.Run("allows service identity read and delete when disabled so folder cleanup can remove leftovers", func(t *testing.T) {
		setGlobalVariablesToggle(t, false)
		svcCtx := identity.WithServiceIdentityContext(context.Background(), 1)
		for _, verb := range []string{"get", "list", "watch", "delete", "deletecollection"} {
			t.Run(verb, func(t *testing.T) {
				decision, reason, err := authz.Authorize(svcCtx, authzAttributes(dashv2beta1.VariableResourceInfo.GetName(), verb))
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionAllow, decision)
				require.Empty(t, reason)
			})
		}
	})

	t.Run("denies service identity writes when disabled", func(t *testing.T) {
		setGlobalVariablesToggle(t, false)
		svcCtx := identity.WithServiceIdentityContext(context.Background(), 1)
		for _, verb := range []string{"create", "update", "patch"} {
			t.Run(verb, func(t *testing.T) {
				decision, reason, err := authz.Authorize(svcCtx, authzAttributes(dashv2beta1.VariableResourceInfo.GetName(), verb))
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionDeny, decision)
				require.Equal(t, "global dashboard variables feature is not enabled", reason)
			})
		}
	})

	t.Run("checks RBAC when the feature is enabled", func(t *testing.T) {
		setGlobalVariablesToggle(t, true)
		// With the flag on, the authorizer proceeds past the feature gate and
		// requires a requester for the variables:* permission check.
		_, reason, err := authz.Authorize(ctx, authzAttributes(dashv2beta1.VariableResourceInfo.GetName(), "get"))
		require.ErrorContains(t, err, "Requester was not found")
		require.Equal(t, "valid user is required", reason)
	})

	t.Run("does not gate other resources on the global variables flag", func(t *testing.T) {
		setGlobalVariablesToggle(t, false)
		// Dashboards must reach the service authorizer regardless of the global
		// variables flag being off.
		_, _, err := authz.Authorize(ctx, authzAttributes(dashv0.DashboardResourceInfo.GetName(), "get"))
		require.ErrorContains(t, err, "no identity found")
	})
}

func TestDashboardsAPIBuilderVariableAuthorizer_StandaloneNilAccessControl(t *testing.T) {
	// NewAPIService leaves accessControl unset. With the flag on, Authorize
	// must deny rather than panic on Evaluate.
	setGlobalVariablesToggle(t, true)
	authz := (&DashboardsAPIBuilder{}).GetAuthorizer()

	for _, verb := range []string{"get", "list", "watch", "create", "update", "delete", "deletecollection"} {
		t.Run(verb, func(t *testing.T) {
			decision, reason, err := authz.Authorize(context.Background(), authzAttributes(dashv2beta1.VariableResourceInfo.GetName(), verb))
			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionDeny, decision)
			require.Equal(t, "access control is not configured", reason)
		})
	}
}
