package dashboard

import (
	"context"
	"slices"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
)

type userPermissionsGetter interface {
	GetUserPermissions(ctx context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error)
}

// CreateGrants lists the folders with a direct dashboards:create grant; descendants inherit it.
type CreateGrants struct {
	All  bool     // wildcard grant, UIDs is empty
	UIDs []string // sorted, deduplicated
}

func ResolveCreateGrants(ctx context.Context, svc userPermissionsGetter, user identity.Requester) (CreateGrants, error) {
	permissions, err := svc.GetUserPermissions(ctx, user, accesscontrol.Options{})
	if err != nil {
		return CreateGrants{}, err
	}

	var scopes []string
	for _, p := range permissions {
		if p.Action == dashboards.ActionDashboardsCreate {
			scopes = append(scopes, p.Scope)
		}
	}

	ids, all := accesscontrol.ParseScopes(folder.ScopeFoldersPrefix, scopes)
	if all {
		return CreateGrants{All: true}, nil
	}

	uids := make([]string, 0, len(ids))
	for id := range ids {
		if uid, ok := id.(string); ok {
			uids = append(uids, uid)
		}
	}
	slices.Sort(uids)
	return CreateGrants{UIDs: uids}, nil
}
