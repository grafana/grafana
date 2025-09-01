package iam

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	gfauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
)

type iamAuthorizer struct {
	resourceAuthorizer map[string]authorizer.Authorizer // Map resource to its authorizer
}

func newIAMAuthorizer(accessClient authlib.AccessClient, legacyAccessClient authlib.AccessClient) authorizer.Authorizer {
	resourceAuthorizer := make(map[string]authorizer.Authorizer)

	// Identity specific resources
	legacyAuthorizer := gfauthorizer.NewResourceAuthorizer(legacyAccessClient)
	resourceAuthorizer[iamv0.UserResourceInfo.GetName()] = legacyAuthorizer
	resourceAuthorizer[iamv0.ServiceAccountResourceInfo.GetName()] = legacyAuthorizer
	resourceAuthorizer[iamv0.TeamResourceInfo.GetName()] = legacyAuthorizer
	resourceAuthorizer["display"] = legacyAuthorizer

	// Access specific resources
	authorizer := gfauthorizer.NewResourceAuthorizer(accessClient)
	resourceAuthorizer[iamv0.CoreRoleInfo.GetName()] = authorizer
	resourceAuthorizer[iamv0.RoleInfo.GetName()] = authorizer
	resourceAuthorizer[iamv0.ResourcePermissionInfo.GetName()] = authorizer
	resourceAuthorizer[iamv0.RoleBindingInfo.GetName()] = authorizer

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

func newLegacyAccessClient(ac accesscontrol.AccessControl, store legacy.LegacyIdentityStore) authlib.AccessClient {
	client := accesscontrol.NewLegacyAccessClient(
		ac,
		accesscontrol.ResourceAuthorizerOptions{
			Resource: iamv0.UserResourceInfo.GetName(),
			Attr:     "id",
			Mapping: map[string]string{
				utils.VerbCreate: accesscontrol.ActionUsersCreate,
				utils.VerbDelete: accesscontrol.ActionUsersDelete,
				utils.VerbGet:    accesscontrol.ActionOrgUsersRead,
				utils.VerbList:   accesscontrol.ActionOrgUsersRead,
			},
			Resolver: accesscontrol.ResourceResolverFunc(func(ctx context.Context, ns authlib.NamespaceInfo, name string) ([]string, error) {
				res, err := store.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{
					UID: name,
				})
				if err != nil {
					return nil, err
				}
				return []string{fmt.Sprintf("users:id:%d", res.ID)}, nil
			}),
		},
		accesscontrol.ResourceAuthorizerOptions{
			Resource: "display",
			Unchecked: map[string]bool{
				utils.VerbGet:  true,
				utils.VerbList: true,
			},
		},
		accesscontrol.ResourceAuthorizerOptions{
			Resource: iamv0.ServiceAccountResourceInfo.GetName(),
			Attr:     "id",
			Resolver: accesscontrol.ResourceResolverFunc(func(ctx context.Context, ns authlib.NamespaceInfo, name string) ([]string, error) {
				res, err := store.GetServiceAccountInternalID(ctx, ns, legacy.GetServiceAccountInternalIDQuery{
					UID: name,
				})
				if err != nil {
					return nil, err
				}
				return []string{fmt.Sprintf("serviceaccounts:id:%d", res.ID)}, nil
			}),
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
