package iam

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	gfauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
)

type iamAuthorizer struct {
	resourceAuthorizer map[string]authorizer.Authorizer // Map resource to its authorizer
}

func newIAMAuthorizer(
	accessClient authlib.AccessClient,
	legacyAccessClient authlib.AccessClient,
	roleApiInstaller RoleApiInstaller,
	globalRoleApiInstaller GlobalRoleApiInstaller,
	teamLbacApiInstaller TeamLBACApiInstaller,
	roleBindingsApiInstaller RoleBindingApiInstaller,
) authorizer.Authorizer {
	resourceAuthorizer := make(map[string]authorizer.Authorizer)

	serviceAuthorizer := gfauthorizer.NewServiceAuthorizer()

	serviceIdentityAuthorizer := authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if identity.IsServiceIdentity(ctx) {
			// A Grafana sub-system should have full access. We trust them to make wise decisions.
			return authorizer.DecisionAllow, "", nil
		}

		req, err := identity.GetRequester(ctx)
		if err == nil && req != nil && req.GetIsGrafanaAdmin() {
			return authorizer.DecisionAllow, "", nil
		}

		return authorizer.DecisionDeny, "", nil
	})

	// Identity specific resources
	legacyAuthorizer := gfauthorizer.NewResourceAuthorizer(legacyAccessClient)
	resourceAuthorizer["display"] = legacyAuthorizer

	// Temporary security fix: Block Watch on ResourcePermissions until proper filtering is implemented
	blockWatchAuthorizer := authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		// Block Watch requests
		if attr.GetVerb() == "watch" {
			return authorizer.DecisionDeny, "watch operation is disabled for ResourcePermissions", nil
		}

		// Allow all other operations (handled by storage layer authorization)
		return authorizer.DecisionAllow, "", nil
	})

	// Access specific resources
	resourceAuthorizer[iamv0.RoleInfo.GetName()] = roleApiInstaller.GetAuthorizer()
	resourceAuthorizer[iamv0.TeamLBACRuleInfo.GetName()] = teamLbacApiInstaller.GetAuthorizer()
	resourceAuthorizer[iamv0.ResourcePermissionInfo.GetName()] = blockWatchAuthorizer // Block Watch, allow others (storage-layer handles authorization)
	resourceAuthorizer[iamv0.RoleBindingInfo.GetName()] = roleBindingsApiInstaller.GetAuthorizer()
	resourceAuthorizer[iamv0.ServiceAccountResourceInfo.GetName()] = newServiceAccountAuthorizer(accessClient)
	resourceAuthorizer[iamv0.UserResourceInfo.GetName()] = newUserAuthorizer(accessClient)
	resourceAuthorizer[iamv0.TeamResourceInfo.GetName()] = newTeamAuthorizer(accessClient)
	resourceAuthorizer["searchUsers"] = serviceAuthorizer
	resourceAuthorizer["searchTeams"] = serviceAuthorizer
	// TODO: Implement fine-grained authorization for external group mapping search on the search level
	resourceAuthorizer["searchExternalGroupMappings"] = serviceIdentityAuthorizer

	resourceAuthorizer[iamv0.GlobalRoleInfo.GetName()] = globalRoleApiInstaller.GetAuthorizer()

	return &iamAuthorizer{resourceAuthorizer: resourceAuthorizer}
}

func (s *iamAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if !attr.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	authz, ok := s.resourceAuthorizer[attr.GetResource()]
	if !ok {
		return authorizer.DecisionDeny, "", fmt.Errorf("no authorizer found for resource %s", attr.GetResource())
	}

	return authz.Authorize(ctx, attr)
}

// allowListAuthorizer allows a nameless list (resource request, no subresource, no name, verb=list)
// at the API layer, deferring per-item filtering to unified storage.
// Otherwise Zanzana maps a nameless list to a group_resource (wildcard) check,
// so only a user who can read every item could list.
//
// Only safe for resources that unified storage filters per-item on list (see
// the authzLimitedClient allowlist in pkg/storage/unified/resource/access.go).
func allowListAuthorizer(base authorizer.Authorizer) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		if attr.IsResourceRequest() && attr.GetSubresource() == "" && attr.GetName() == "" && attr.GetVerb() == utils.VerbList {
			if _, ok := authlib.AuthInfoFrom(ctx); ok {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "cannot list resource without an identity", nil
		}
		return base.Authorize(ctx, attr)
	})
}

// newTeamAuthorizer authorizes the "members", "groups", "addmember" and
// "removemember" subresources:
//   - members / groups: read paths, gated on `get_permissions` on the
//     parent team.
//   - addmember / removemember: single-member writes, gated on `update`
//     on the parent team — same bar as a full PUT.
func newTeamAuthorizer(accessClient authlib.AccessClient) authorizer.Authorizer {
	check := func(verb string, denyReason string) gfauthorizer.SubresourceCheck {
		return func(ctx context.Context, ident authlib.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			res, err := accessClient.Check(ctx, ident, authlib.CheckRequest{
				Verb:      verb,
				Group:     attr.GetAPIGroup(),
				Resource:  attr.GetResource(),
				Namespace: attr.GetNamespace(),
				Name:      attr.GetName(),
			}, "")
			if err != nil {
				return authorizer.DecisionDeny, "", err
			}
			if !res.Allowed {
				return authorizer.DecisionDeny, denyReason, nil
			}
			return authorizer.DecisionAllow, "", nil
		}
	}
	getPermissions := check(utils.VerbGetPermissions, "requires team getpermissions")
	update := check(utils.VerbUpdate, "requires team update")
	base := gfauthorizer.NewResourceAuthorizerWithSubresourceHandlers(accessClient, map[string]gfauthorizer.SubresourceCheck{
		"members":      getPermissions,
		"groups":       getPermissions,
		"addmember":    update,
		"removemember": update,
	})

	return allowListAuthorizer(base)
}

// newUserAuthorizer creates an authorizer for users that handles the "teams" and "status" subresources.
// "teams" is read-only (Connecter/GET), so it checks user get.
// "status" supports both GET and PUT, so the check verb mirrors the request verb.
func newUserAuthorizer(accessClient authlib.AccessClient) authorizer.Authorizer {
	base := gfauthorizer.NewResourceAuthorizerWithSubresourceHandlers(accessClient, map[string]gfauthorizer.SubresourceCheck{
		"teams": func(ctx context.Context, ident authlib.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			res, err := accessClient.Check(ctx, ident, authlib.CheckRequest{
				Verb:      utils.VerbGet,
				Group:     attr.GetAPIGroup(),
				Resource:  attr.GetResource(),
				Namespace: attr.GetNamespace(),
				Name:      attr.GetName(),
			}, "")
			if err != nil {
				return authorizer.DecisionDeny, "", err
			}
			if !res.Allowed {
				return authorizer.DecisionDeny, "requires user get", nil
			}
			return authorizer.DecisionAllow, "", nil
		},
		"status": func(ctx context.Context, ident authlib.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			verb := utils.VerbGet
			if attr.GetVerb() == utils.VerbUpdate || attr.GetVerb() == utils.VerbPatch {
				verb = utils.VerbUpdate
			}
			res, err := accessClient.Check(ctx, ident, authlib.CheckRequest{
				Verb:      verb,
				Group:     attr.GetAPIGroup(),
				Resource:  attr.GetResource(),
				Namespace: attr.GetNamespace(),
				Name:      attr.GetName(),
			}, "")
			if err != nil {
				return authorizer.DecisionDeny, "", err
			}
			if !res.Allowed {
				return authorizer.DecisionDeny, fmt.Sprintf("requires user %s", verb), nil
			}
			return authorizer.DecisionAllow, "", nil
		},
	})

	return allowListAuthorizer(base)
}

// newServiceAccountAuthorizer creates an authorizer for service accounts that handles the "tokens" subresource.
// Token operations are mapped to align with the legacy API permissions:
//   - GET  (get/list) → serviceaccounts:read  (verb "get")
//   - POST (create)   → serviceaccounts:write  (verb "update")
//   - DELETE           → serviceaccounts:write  (verb "update")
//
// The nameless list is allowed at the API layer (see
// allowList); unified storage filters service accounts per-item.
func newServiceAccountAuthorizer(accessClient authlib.AccessClient) authorizer.Authorizer {
	base := gfauthorizer.NewResourceAuthorizerWithSubresourceHandlers(accessClient, map[string]gfauthorizer.SubresourceCheck{
		"tokens": func(ctx context.Context, ident authlib.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			// Map verbs to match the legacy API: read operations use "get",
			// write operations (create/delete) use "update" → serviceaccounts:write.
			verb := attr.GetVerb()
			switch verb {
			case utils.VerbCreate, utils.VerbDelete:
				verb = utils.VerbUpdate
			}

			res, err := accessClient.Check(ctx, ident, authlib.CheckRequest{
				Verb:      verb,
				Group:     attr.GetAPIGroup(),
				Resource:  attr.GetResource(),
				Namespace: attr.GetNamespace(),
				Name:      attr.GetName(),
			}, "")
			if err != nil {
				return authorizer.DecisionDeny, "", err
			}
			if !res.Allowed {
				return authorizer.DecisionDeny, fmt.Sprintf("requires serviceaccount %s", verb), nil
			}
			return authorizer.DecisionAllow, "", nil
		},
	})

	return allowListAuthorizer(base)
}

func newLegacyAccessClient(ac accesscontrol.AccessControl, store legacy.LegacyIdentityStore) authlib.AccessClient {
	client := accesscontrol.NewLegacyAccessClient(
		ac,
		accesscontrol.ResourceAuthorizerOptions{
			Resource: "display",
			Unchecked: map[string]bool{
				utils.VerbGet:  true,
				utils.VerbList: true,
			},
		},
		accesscontrol.ResourceAuthorizerOptions{
			Resource: "searchTeams",
			Unchecked: map[string]bool{
				utils.VerbGet:  true,
				utils.VerbList: true,
			},
		},
		accesscontrol.ResourceAuthorizerOptions{
			Resource: iamv0.TeamResourceInfo.GetName(),
			Attr:     "id",
			Resolver: accesscontrol.ResourceResolverFunc(func(ctx context.Context, ns authlib.NamespaceInfo, name string) ([]string, error) {
				res, err := store.GetTeamInternalID(ctx, ns, legacy.GetTeamInternalIDQuery{
					UID: name,
				})
				if err != nil {
					return nil, err
				}
				return []string{fmt.Sprintf("teams:id:%d", res.ID)}, nil
			}),
		},
	)

	return client
}
