package folders

import (
	"context"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	folderLegacy "github.com/grafana/grafana/pkg/services/folder"
)

type parentsGetter = func(ctx context.Context, folder *folders.Folder) (*folders.FolderInfoList, error)

func newParentsGetter(getter rest.Getter) parentsGetter {
	return newParentsGetterWithPolicy(getter, false)
}

func newCreateParentsGetter(getter rest.Getter) parentsGetter {
	return newParentsGetterWithPolicy(getter, true)
}

func newParentsGetterWithPolicy(getter rest.Getter, forCreate bool) parentsGetter {
	return func(ctx context.Context, folder *folders.Folder) (*folders.FolderInfoList, error) {
		ctx, span := tracer.Start(ctx, "folders.getParents")
		defer span.End()

		info := &folders.FolderInfoList{
			Items: []folders.FolderInfo{},
		}
		id := folder.Name
		if id == folderLegacy.GeneralFolderUID || id == folderLegacy.SharedWithMeFolderUID {
			info.Items = []folders.FolderInfo{{
				Name:  folder.Name,
				Title: folder.Spec.Title,
			}}
			return info, nil
		}

		found := make(map[string]bool)
		found[folder.Name] = true
		var err error
		lookupCtx := ctx

		for folder != nil {
			meta, _ := utils.MetaAccessor(folder)
			item := folders.FolderInfo{
				Name:   folder.Name,
				Title:  folder.Spec.Title,
				Parent: meta.GetFolder(),
			}
			if folder.Spec.Description != nil {
				item.Description = *folder.Spec.Description
			}
			info.Items = append(info.Items, item)
			if folderLegacy.IsRootFolderUID(item.Parent) {
				break
			}

			if found[item.Parent] {
				return nil, tracing.Error(span, folderLegacy.ErrCyclicReference.Errorf("cyclic folder references found: %s", item.Parent))
			}

			// Creation must read the immediate parent as the caller. Hierarchy checks
			// must inspect all existing ancestors regardless of caller visibility, or
			// hidden ancestors could bypass depth and k6 restrictions. Elevate only
			// these reads; k6 eligibility and writes must retain the original caller.
			if forCreate && len(info.Items) == 2 {
				ns, err := request.NamespaceInfoFrom(ctx, true)
				if err != nil {
					return nil, tracing.Error(span, folderLegacy.ErrInternal.Errorf("unable to resolve ancestry namespace: %w", err))
				}
				lookupCtx = identity.WithServiceIdentityContext(ctx, ns.OrgID, func(id *identity.StaticRequester) {
					id.Namespace = ns.Value
				})
			}

			obj, e2 := getter.Get(lookupCtx, item.Parent, &metav1.GetOptions{})
			if e2 != nil {
				// Normalize transport and embedded statuses for both log severity and
				// the creation policy's missing/immediate-unreadable parent exception.
				public := backendStatusError(e2)
				logger := backendLogger.FromContext(ctx)
				args := []any{"operation", "parentLookup", "namespace", folder.Namespace, "folder", folder.Name, "parent", item.Parent, "error", e2}
				if apierrors.IsNotFound(&public) || (apierrors.IsForbidden(&public) && (!forCreate || len(info.Items) == 1)) {
					logger.Debug("Unable to read parent folder", args...)
				} else {
					_ = tracing.Error(span, e2)
					if forCreate {
						logger.Error("Unable to read parent folder", args...)
						return nil, &public
					}
					logger.Warn("Unable to read parent folder", args...)
				}
				info.Items = append(info.Items, folders.FolderInfo{
					Name:        item.Parent,
					Detached:    true,
					Description: "Unable to read parent folder",
				})
				break
			}

			parentFolder, ok := obj.(*folders.Folder)
			if !ok {
				err := tracing.Errorf(span, "expected folder, found: %T", obj)
				backendLogger.FromContext(ctx).Error("Unexpected parent folder object", "operation", "parentLookup", "namespace", folder.Namespace, "folder", folder.Name, "parent", item.Parent, "error", err)
				if forCreate {
					return nil, folderLegacy.ErrInternal.Errorf("unable to read folder ancestry: %w", err)
				}
				info.Items = append(info.Items, folders.FolderInfo{
					Name:        item.Parent,
					Detached:    true,
					Description: "Unable to read parent folder",
				})
				break
			}
			found[parentFolder.Name] = true
			folder = parentFolder
		}

		// Start from the root
		slices.Reverse(info.Items)
		return info, err
	}
}
