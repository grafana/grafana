package folders

import (
	"context"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func pendingDeletionAuthorizer(base authorizer.Authorizer) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		resource := foldersv1.PendingFolderDeletionResourceInfo.GroupResource()
		if !attr.IsResourceRequest() || attr.GetAPIGroup() != resource.Group || attr.GetResource() != resource.Resource {
			return base.Authorize(ctx, attr)
		}
		if identity.IsServiceIdentity(ctx) {
			return authorizer.DecisionAllow, "", nil
		}
		info, ok := types.AuthInfoFrom(ctx)
		if ok {
			permission := authz.CheckServicePermissions(info, resource.Group, resource.Resource, attr.GetVerb())
			if permission.ServiceCall && permission.Allowed {
				return authorizer.DecisionAllow, "", nil
			}
		}
		return authorizer.DecisionDeny, "pending folder deletions require an authorized internal service", nil
	})
}
