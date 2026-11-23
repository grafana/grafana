package folders

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"

	claims "github.com/grafana/authlib/types"
	sdkres "github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func filterK6FoldersFromList(ctx context.Context, obj runtime.Object) runtime.Object {
	requester, _ := identity.GetRequester(ctx)
	if identity.IsServiceIdentity(ctx) || requester != nil && requester.IsIdentityType(claims.TypeServiceAccount) {
		return obj
	}

	list, ok := obj.(sdkres.ListObject)
	if !ok {
		return obj
	}

	items := list.GetItems()
	visible := make([]sdkres.Object, 0, len(items))
	for _, item := range items {
		if item.GetName() == accesscontrol.K6FolderUID {
			continue
		}
		if item.GetAnnotations()[utils.AnnoKeyFolder] == accesscontrol.K6FolderUID {
			continue
		}
		visible = append(visible, item)
	}

	list.SetItems(visible)
	list.SetRemainingItemCount(nil)
	return list
}
