package folder

import (
	"context"
	"errors"
	"strings"

	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	ScopeFoldersRoot   = "folders"
	ScopeFoldersPrefix = "folders:uid:"

	ActionFoldersCreate           = "folders:create"
	ActionFoldersRead             = "folders:read"
	ActionFoldersWrite            = "folders:write"
	ActionFoldersDelete           = "folders:delete"
	ActionFoldersPermissionsRead  = "folders.permissions:read"
	ActionFoldersPermissionsWrite = "folders.permissions:write"
)

var (
	ScopeFoldersProvider = ac.NewScopeProvider(ScopeFoldersRoot)
	ScopeFoldersAll      = ScopeFoldersProvider.GetResourceAllScope()
	tracer               = otel.Tracer("github.com/grafana/grafana/pkg/services/folder")
)

type UIDLookup = func(ctx context.Context, orgID int64, id int64) (string, error)

// NewFolderIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:id:" into an uid based scope.
func NewFolderIDScopeResolver(lookup UIDLookup, folderSvc Service) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeFoldersProvider.GetResourceScope("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		ctx, span := tracer.Start(ctx, "dashboards.NewFolderIDScopeResolver")
		span.End()

		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		id, err := ac.ParseScopeID(scope)
		if err != nil {
			return nil, err
		}

		if id == 0 {
			return []string{ScopeFoldersProvider.GetResourceScopeUID(ac.GeneralFolderUID)}, nil
		}

		return identity.WithServiceIdentityFn(ctx, orgID, func(ctx context.Context) ([]string, error) {
			uid, err := lookup(ctx, orgID, id)
			if err != nil {
				return nil, err
			}

			result, err := GetInheritedScopes(ctx, orgID, uid, folderSvc)
			if err != nil {
				return nil, err
			}

			return append([]string{ScopeFoldersProvider.GetResourceScopeUID(uid)}, result...), nil
		})
	})
}

// NewFolderUIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:uid:"
// into uid based scopes for folder and its parents
func NewFolderUIDScopeResolver(folderSvc Service) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeFoldersProvider.GetResourceScopeUID("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		ctx, span := tracer.Start(ctx, "dashboards.NewFolderUIDScopeResolver")
		span.End()

		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		uid, err := ac.ParseScopeUID(scope)
		if err != nil {
			return nil, err
		}

		return identity.WithServiceIdentityFn(ctx, orgID, func(ctx context.Context) ([]string, error) {
			inheritedScopes, err := GetInheritedScopes(ctx, orgID, uid, folderSvc)
			if err != nil {
				return nil, err
			}
			return append(inheritedScopes, ScopeFoldersProvider.GetResourceScopeUID(uid)), nil
		})
	})
}

func GetInheritedScopes(ctx context.Context, orgID int64, folderUID string, folderSvc Service) ([]string, error) {
	ctx, span := tracer.Start(ctx, "dashboards.GetInheritedScopes")
	span.End()

	if folderUID == ac.GeneralFolderUID {
		return nil, nil
	}
	ancestors, err := folderSvc.GetParents(ctx, GetParentsQuery{
		UID:   folderUID,
		OrgID: orgID,
	})

	if err != nil {
		if errors.Is(err, ErrFolderNotFound) {
			return nil, err
		}
		return nil, ac.ErrInternal.Errorf("could not retrieve folder parents: %w", err)
	}

	result := make([]string, 0, len(ancestors))
	for _, ff := range ancestors {
		result = append(result, ScopeFoldersProvider.GetResourceScopeUID(ff.UID))
	}

	return result, nil
}
