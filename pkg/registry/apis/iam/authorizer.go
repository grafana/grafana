package iam

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func newLegacyAuthorizer(ac accesscontrol.AccessControl, store legacy.LegacyIdentityStore) authorizer.Authorizer {
	return accesscontrol.NewAuthorizerChain(
		accesscontrol.NewResourceAuthorizer(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "users",
			Attr:     "id",
			Mapping: map[string]string{
				"get":  accesscontrol.ActionOrgUsersRead,
				"list": accesscontrol.ActionOrgUsersRead,
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
		}),
	)
}
