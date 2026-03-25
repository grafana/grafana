package iam

import (
	"context"
	"errors"
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
	externalGroupMappingApiInstaller ExternalGroupMappingApiInstaller,
) authorizer.Authorizer {
	resourceAuthorizer := make(map[string]authorizer.Authorizer)

	serviceAuthorizer := gfauthorizer.NewServiceAuthorizer()
	// Authorizer that allows any authenticated user
	// To be used when authorization is handled at the storage layer
	allowAuthorizer := authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		// Any authenticated user can access the API
		return authorizer.DecisionAllow, "", nil
	})

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

	// Access specific resources
	authorizer := gfauthorizer.NewResourceAuthorizer(accessClient)
	resourceAuthorizer[iamv0.RoleInfo.GetName()] = roleApiInstaller.GetAuthorizer()
	resourceAuthorizer[iamv0.TeamLBACRuleInfo.GetName()] = teamLbacApiInstaller.GetAuthorizer()
	resourceAuthorizer[iamv0.ResourcePermissionInfo.GetName()] = allowAuthorizer // Handled by the backend wrapper
	resourceAuthorizer[iamv0.RoleBindingInfo.GetName()] = authorizer
	resourceAuthorizer[iamv0.ServiceAccountResourceInfo.GetName()] = authorizer
	resourceAuthorizer[iamv0.UserResourceInfo.GetName()] = authorizer
	resourceAuthorizer[iamv0.ExternalGroupMappingResourceInfo.GetName()] = externalGroupMappingApiInstaller.GetAuthorizer()
	resourceAuthorizer[iamv0.TeamResourceInfo.GetName()] = newTeamAuthorizer(accessClient)
	resourceAuthorizer[iamv0.TeamBindingResourceInfo.GetName()] = allowAuthorizer
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

// newTeamAuthorizer creates an authorizer for teams that handles the "members" subresource
// with a get_permissions check on the parent team resource.
func newTeamAuthorizer(accessClient authlib.AccessClient) authorizer.Authorizer {
	delegate := gfauthorizer.NewResourceAuthorizer(accessClient)
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		subresource := attr.GetSubresource()
		if subresource == "members" {
			ident, ok := authlib.AuthInfoFrom(ctx)
			if !ok {
				return authorizer.DecisionDeny, "", errors.New("no identity found")
			}

			res, err := accessClient.Check(ctx, ident, authlib.CheckRequest{
				Verb:      utils.VerbGetPermissions,
				Group:     attr.GetAPIGroup(),
				Resource:  attr.GetResource(),
				Namespace: attr.GetNamespace(),
				Name:      attr.GetName(),
			}, "")
			if err != nil {
				return authorizer.DecisionDeny, "", err
			}
			if !res.Allowed {
				return authorizer.DecisionDeny, "requires team getpermissions", nil
			}
			return authorizer.DecisionAllow, "", nil
		}

		// Delegate to the standard ResourceAuthorizer for non-members subresources
		return delegate.Authorize(ctx, attr)
	})
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
