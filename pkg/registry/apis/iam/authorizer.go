package iam

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func newLegacyAccessClient(ac accesscontrol.AccessControl, store legacy.LegacyIdentityStore) authlib.AccessClient {
	client := accesscontrol.NewLegacyAccessClient(
		ac,
		accesscontrol.ResourceAuthorizerOptions{
			Resource: iamv0.UserResourceInfo.GetName(),
			Attr:     "id",
			Mapping: map[string]string{
				utils.VerbGet:  accesscontrol.ActionOrgUsersRead,
				utils.VerbList: accesscontrol.ActionOrgUsersRead,
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
