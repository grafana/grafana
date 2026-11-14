package dashboard

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// A variable so tests can stand in for Git Sync's provisioning identity.
var dashboardPreferencesIsProvisioning = identity.IsProvisioningServiceIdentity

// newDashboardPreferencesAuthorizer authorizes dashboard.grafana.app/dashboardpreferences requests by tier.
//
// It never returns NoOpinion for a resource request: NoOpinion falls through to the role
// authorizer, which lets any Editor write. accessControl is nil where the API runs apart from Grafana.
func newDashboardPreferencesAuthorizer(accessClient authlib.AccessClient, accessControl accesscontrol.AccessControl, serviceAuthorizer authorizer.Authorizer) authorizer.Authorizer {
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
			// authorizer lets into any namespace, from reading another org's preferences through merged.
			if requester.IsIdentityType(authlib.TypeAnonymous, authlib.TypeRenderService) {
				return authorizer.DecisionDeny, "dashboard preferences are not available to anonymous or render identities", nil
			}

			verb := attr.GetVerb()
			if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagGrafanaDashboardPreferences, false, openfeature.TransactionContext(ctx)) {
				// Folder and user cleanup must still find and delete leftovers after the flag is turned
				// off, including when the multi-tenant folder app calls with its own token.
				if identity.IsServiceIdentity(ctx) {
					switch verb {
					case utils.VerbGet, utils.VerbList, utils.VerbDelete:
						return authorizer.DecisionAllow, "", nil
					}
				}
				if requester.IsIdentityType(authlib.TypeAccessPolicy) && verb == utils.VerbDelete {
					return serviceAuthorizer.Authorize(ctx, attr)
				}
				return authorizer.DecisionDeny, "dashboard preferences feature is not enabled", nil
			}

			if decision, reason, err := serviceAuthorizer.Authorize(ctx, attr); decision != authorizer.DecisionAllow {
				return decision, reason, err
			}

			// A repository file could otherwise create any tier, and the object would then be managed by
			// the repository, so its owner could not remove it.
			// Only an access-policy identity can be Git Sync's provisioning identity.
			if requester.IsIdentityType(authlib.TypeAccessPolicy) && dashboardPreferencesIsProvisioning(requester) {
				switch verb {
				case utils.VerbGet, utils.VerbList, utils.VerbDelete:
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "dashboard preferences can't be provisioned", nil
			}

			if requester.IsIdentityType(authlib.TypeAccessPolicy) {
				if identity.IsServiceIdentity(ctx) {
					return authorizer.DecisionAllow, "", nil
				}
				// The tier rules judge a request by the user making it, and a token has none, so it would reach
				// every user's tier. It gets only what folder and user cleanup need: a delete by name.
				if verb == utils.VerbDelete {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "access policy tokens can only delete dashboard preferences", nil
			}

			// Both span every tier, so they would expose or remove other users' objects.
			if verb == utils.VerbWatch || verb == utils.VerbDeleteCollection {
				return authorizer.DecisionDeny, "not supported for dashboard preferences", nil
			}

			switch attr.GetName() {
			case "":
				// The storage wrapper filters a list by tier, and admission authorizes the name a create
				// derives.
				if verb == utils.VerbList || verb == utils.VerbCreate {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "invalid dashboard preferences name", nil
			case dashboardPreferencesMergedName:
				// A merge starts from the org tier, so only a caller who can read that tier gets one. The merged
				// handler must apply each tier's rules, including the namespace match, to every tier it reads.
				if verb == utils.VerbGet {
					return authorizeDashboardPreferencesName(ctx, accessClient, accessControl, requester, attr.GetNamespace(), dashv2beta1.DashboardPreferencesOrgName, utils.VerbGet)
				}
				return authorizer.DecisionDeny, "merged dashboard preferences are read-only", nil
			}

			return authorizeDashboardPreferencesName(ctx, accessClient, accessControl, requester, attr.GetNamespace(), attr.GetName(), verb)
		})
}

// authorizeDashboardPreferencesName applies the tier rules to a named object. It stands apart from the
// authorizer for callers that learn the name only after authorization, such as a create whose name
// is derived.
func authorizeDashboardPreferencesName(ctx context.Context, accessClient authlib.AccessClient, accessControl accesscontrol.AccessControl, requester identity.Requester, namespace, name, verb string) (authorizer.Decision, string, error) {
	scope, ok := dashboardPreferencesScopeFromName(name)
	if !ok {
		return authorizer.DecisionDeny, "invalid dashboard preferences name", nil
	}

	read := verb == utils.VerbGet || verb == utils.VerbList || verb == utils.VerbWatch
	// Grafana admins pass the namespace authorizer for every namespace, so each tier checks the
	// caller's namespace itself.
	inNamespace := authlib.NamespaceMatches(requester.GetNamespace(), namespace)
	switch scope.Tier {
	case dashboardPreferencesTierOrg:
		// Every stack's namespace parses to org 1, so the org ID alone doesn't show membership.
		nsInfo, err := authlib.ParseNamespace(namespace)
		if err != nil || nsInfo.OrgID != requester.GetOrgID() || !inNamespace {
			return authorizer.DecisionDeny, "only org members can access org dashboard preferences", nil
		}
		if read {
			return authorizer.DecisionAllow, "", nil
		}
		allowed, err := canWriteDashboardPreferencesOrgTier(ctx, accessControl, requester)
		if err != nil || !allowed {
			return authorizer.DecisionDeny, "only org admins can change org dashboard preferences", err
		}
		return authorizer.DecisionAllow, "", nil

	case dashboardPreferencesTierUser:
		if requester.IsIdentityType(authlib.TypeUser) && requester.GetIdentifier() == scope.UserUID && inNamespace {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "only the owner can access user dashboard preferences", nil

	case dashboardPreferencesTierFolder:
		folderVerb, reason := utils.VerbSetPermissions, "only folder admins can change folder dashboard preferences"
		if read {
			folderVerb, reason = utils.VerbGet, "folder access denied"
		}
		allowed, err := checkDashboardPreferencesFolderAccess(ctx, accessClient, requester, namespace, scope.FolderUID, folderVerb)
		if err != nil || !allowed {
			return authorizer.DecisionDeny, reason, err
		}
		return authorizer.DecisionAllow, "", nil
	}

	return authorizer.DecisionDeny, "invalid dashboard preferences name", nil
}

// The org tier sits beside org preferences, so it takes their write permission, which org admins hold
// by default. Only classic access control can check that permission: the authz mapper has no entry for
// it. Without classic access control, where the API runs apart from Grafana, the org admin role decides.
func canWriteDashboardPreferencesOrgTier(ctx context.Context, accessControl accesscontrol.AccessControl, requester identity.Requester) (bool, error) {
	if !requester.IsIdentityType(authlib.TypeUser, authlib.TypeServiceAccount) {
		return false, nil
	}
	if accessControl == nil {
		return requester.GetOrgRole() == identity.RoleAdmin, nil
	}

	allowed, err := accessControl.Evaluate(ctx, requester, accesscontrol.EvalPermission(accesscontrol.ActionOrgsPreferencesWrite))
	if err != nil {
		logging.FromContext(ctx).Error("dashboard preferences failed to check org preferences access", "err", err)
		return false, &accessCheckError{subject: "org preferences", cause: err}
	}
	return allowed, nil
}

func checkDashboardPreferencesFolderAccess(ctx context.Context, accessClient authlib.AccessClient, requester identity.Requester, namespace, folderUID, verb string) (bool, error) {
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
		logging.FromContext(ctx).Error("dashboard preferences failed to check folder access",
			"namespace", namespace, "folder", folderUID, "err", err)
		return false, &accessCheckError{subject: "folder", cause: err}
	}
	return resp.Allowed, nil
}
