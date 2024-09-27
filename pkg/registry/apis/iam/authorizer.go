package iam

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/claims"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	gfauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
)

func newLegacyAuthorizer(ac accesscontrol.AccessControl, store legacy.LegacyIdentityStore) (authorizer.Authorizer, claims.AccessClient) {
	client := accesscontrol.NewLegacyAccessClient(
		ac,
		accesscontrol.ResourceAuthorizerOptions{
			Resource: iamv0.UserResourceInfo.GetName(),
			Attr:     "id",
			Mapping: map[string]string{
				utils.VerbGet:  accesscontrol.ActionOrgUsersRead,
				utils.VerbList: accesscontrol.ActionOrgUsersRead,
			},
			Resolver: accesscontrol.ResourceResolverFunc(func(ctx context.Context, ns claims.NamespaceInfo, name string) ([]string, error) {
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
			Resolver: accesscontrol.ResourceResolverFunc(func(ctx context.Context, ns claims.NamespaceInfo, name string) ([]string, error) {
				res, err := store.GetServiceAccountInternalID(ctx, ns, legacy.GetServiceAccountInternalIDQuery{
					UID: name,
				})
				if err != nil {
					return nil, err
				}
				return []string{fmt.Sprintf("serviceaccounts:id:%d", res.ID)}, nil
			}),
		},
	)

	return gfauthorizer.NewResourceAuthorizer(client), client
}
