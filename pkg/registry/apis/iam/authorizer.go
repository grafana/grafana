package iam

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/claims"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	gfauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
)

func newLegacyAuthorizer(ac accesscontrol.AccessControl, store legacy.LegacyIdentityStore) (authorizer.Authorizer, claims.AccessClient) {
	client := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
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
	})

	return gfauthorizer.NewResourceAuthorizer(client), client
}
