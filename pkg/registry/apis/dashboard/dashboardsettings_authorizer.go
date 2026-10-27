package dashboard

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// newDashboardSettingsAuthorizer authorizes dashboard.grafana.app/dashboardsettings requests by tier.
//
// It never returns NoOpinion for a resource request: NoOpinion falls through to the role
// authorizer, which lets any Editor write.
func newDashboardSettingsAuthorizer(accessClient authlib.AccessClient, serviceAuthorizer authorizer.Authorizer) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			requester, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			// No tier serves these identities. This also keeps anonymous callers, whom the namespace
			// authorizer lets into any namespace, from reading another org's settings through merged.
			if requester.IsIdentityType(authlib.TypeAnonymous, authlib.TypeRenderService) {
				return authorizer.DecisionDeny, "dashboard settings are not available to anonymous or render identities", nil
			}

			verb := attr.GetVerb()
			if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagGrafanaDashboardSettings, false, openfeature.TransactionContext(ctx)) {
				// Folder and user cleanup must still find and delete leftovers after the flag is turned
				// off, including when the multi-tenant folder app calls with its own token.
				if identity.IsServiceIdentity(ctx) {
					switch verb {
					case utils.VerbGet, utils.VerbList, utils.VerbWatch, utils.VerbDelete, utils.VerbDeleteCollection:
						return authorizer.DecisionAllow, "", nil
					}
				}
				if requester.IsIdentityType(authlib.TypeAccessPolicy) {
					switch verb {
					case utils.VerbGet, utils.VerbList, utils.VerbDelete:
						return serviceAuthorizer.Authorize(ctx, attr)
					}
				}
				return authorizer.DecisionDeny, "dashboard settings feature is not enabled", nil
			}

			if decision, reason, err := serviceAuthorizer.Authorize(ctx, attr); decision != authorizer.DecisionAllow {
				return decision, reason, err
			}

			// A repository file could otherwise create any tier, and the object would then be managed by
			// the repository, so its owner could not remove it.
			if identity.IsProvisioningServiceIdentity(requester) {
				switch verb {
				case utils.VerbGet, utils.VerbList, utils.VerbDelete:
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "dashboard settings can't be provisioned", nil
			}

			if requester.IsIdentityType(authlib.TypeAccessPolicy) {
				if identity.IsServiceIdentity(ctx) {
					return authorizer.DecisionAllow, "", nil
				}
				// The tier rules judge a write by the user making it, and a token has none.
				switch verb {
				case utils.VerbGet, utils.VerbList, utils.VerbDelete:
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "access policy tokens can only get, list and delete dashboard settings", nil
			}

			// Both span every tier, so they would expose or remove other users' objects.
			if verb == utils.VerbWatch || verb == utils.VerbDeleteCollection {
				return authorizer.DecisionDeny, "not supported for dashboard settings", nil
			}

			switch attr.GetName() {
			case "":
				// The storage wrapper filters a list by tier, and admission authorizes the name a create
				// derives.
				if verb == utils.VerbList || verb == utils.VerbCreate {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "invalid dashboard settings name", nil
			case dashboardSettingsMergedName:
				// The merged handler checks folder access for the folder it merges.
				if verb == utils.VerbGet {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "merged dashboard settings are read-only", nil
			}

			return authorizeDashboardSettingsName(ctx, accessClient, requester, attr.GetNamespace(), attr.GetName(), verb)
		})
}

// authorizeDashboardSettingsName applies the tier rules to a named object. It stands apart from the
// authorizer for callers that learn the name only after authorization, such as a create whose name
// is derived.
func authorizeDashboardSettingsName(ctx context.Context, accessClient authlib.AccessClient, requester identity.Requester, namespace, name, verb string) (authorizer.Decision, string, error) {
	scope, ok := dashboardSettingsScopeFromName(name)
	if !ok {
		return authorizer.DecisionDeny, "invalid dashboard settings name", nil
	}

	read := verb == utils.VerbGet || verb == utils.VerbList || verb == utils.VerbWatch
	// Grafana admins pass the namespace authorizer for every namespace, so each tier checks the
	// caller's namespace itself.
	inNamespace := authlib.NamespaceMatches(requester.GetNamespace(), namespace)
	switch scope.Tier {
	case dashboardSettingsTierOrg:
		// Every stack's namespace parses to org 1, so the org ID alone doesn't show membership.
		nsInfo, err := authlib.ParseNamespace(namespace)
		if err != nil || nsInfo.OrgID != requester.GetOrgID() || !inNamespace {
			return authorizer.DecisionDeny, "only org members can access org dashboard settings", nil
		}
		if read {
			return authorizer.DecisionAllow, "", nil
		}
		if requester.IsIdentityType(authlib.TypeUser, authlib.TypeServiceAccount) && requester.GetOrgRole() == identity.RoleAdmin {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "only org admins can change org dashboard settings", nil

	case dashboardSettingsTierUser:
		if requester.IsIdentityType(authlib.TypeUser) && requester.GetIdentifier() == scope.UserUID && inNamespace {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "only the owner can access user dashboard settings", nil

	case dashboardSettingsTierFolder:
		folderVerb, reason := utils.VerbSetPermissions, "only folder admins can change folder dashboard settings"
		if read {
			folderVerb, reason = utils.VerbGet, "folder access denied"
		}
		allowed, err := checkDashboardSettingsFolderAccess(ctx, accessClient, requester, namespace, scope.FolderUID, folderVerb)
		if err != nil || !allowed {
			return authorizer.DecisionDeny, reason, err
		}
		return authorizer.DecisionAllow, "", nil
	}

	return authorizer.DecisionDeny, "invalid dashboard settings name", nil
}

func checkDashboardSettingsFolderAccess(ctx context.Context, accessClient authlib.AccessClient, requester identity.Requester, namespace, folderUID, verb string) (bool, error) {
	if accessClient == nil {
		return false, nil
	}
	// The access client returns an error for another namespace, and the apiserver turns an
	// authorizer error into a 500.
	if !authlib.NamespaceMatches(requester.GetNamespace(), namespace) {
		return false, nil
	}

	// Passing the folder as its own parent lets grants inherited from its ancestors apply without
	// reading the folder first.
	resp, err := accessClient.Check(ctx, requester, authlib.CheckRequest{
		Verb:      verb,
		Group:     folders.GROUP,
		Resource:  folders.RESOURCE,
		Namespace: namespace,
		Name:      folderUID,
	}, folderUID)
	if err != nil {
		return false, err
	}
	return resp.Allowed, nil
}
