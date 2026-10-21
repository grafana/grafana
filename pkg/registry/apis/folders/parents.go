package folders

import (
	"context"
	"net/http"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	foldererrors "github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	folderLegacy "github.com/grafana/grafana/pkg/services/folder"
)

type parentsGetter = func(ctx context.Context, folder *folders.Folder) (*folders.FolderInfoList, error)

// Lookup statuses may contain backend diagnostics even when they are already
// Kubernetes errors. Retain only classification and retry hints at this boundary.
func createParentLookupStatusError(err error) apierrors.StatusError {
	mapped := foldererrors.ToFolderStatusError(err)
	code := int(mapped.ErrStatus.Code)
	switch {
	case apierrors.IsNotFound(&mapped):
		code = http.StatusNotFound
	case apierrors.IsForbidden(&mapped):
		code = http.StatusForbidden
	}
	if code < 400 || code > 599 {
		code = http.StatusInternalServerError
	}
	retryAfter := 0
	if details := mapped.ErrStatus.Details; details != nil && details.RetryAfterSeconds > 0 {
		retryAfter = int(details.RetryAfterSeconds)
	}
	public := apierrors.NewGenericServerResponse(code, "", schema.GroupResource{}, "", "", retryAfter, false)
	if code == 499 {
		public.ErrStatus.Message = "Request canceled"
		public.ErrStatus.Reason = "ClientClosedRequest"
	} else if apierrors.IsAlreadyExists(&mapped) {
		public.ErrStatus.Reason = metav1.StatusReasonAlreadyExists
	}
	return *public
}

func newParentsGetter(getter rest.Getter, maxDepth int) parentsGetter {
	return newParentsGetterWithPolicy(getter, false)
}

func newCreateParentsGetter(getter rest.Getter, maxDepth int) parentsGetter {
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
				_ = tracing.Error(span, e2)
				if forCreate {
					// Classify both transport and embedded statuses before applying the
					// missing/immediate-unreadable parent exception, including dry runs.
					public := createParentLookupStatusError(e2)
					if !apierrors.IsNotFound(&public) && (len(info.Items) != 1 || !apierrors.IsForbidden(&public)) {
						return nil, &public
					}
				}
				info.Items = append(info.Items, folders.FolderInfo{
					Name:        item.Parent,
					Detached:    true,
					Description: e2.Error(),
				})
				break
			}

			parentFolder, ok := obj.(*folders.Folder)
			if !ok {
				err := tracing.Errorf(span, "expected folder, found: %T", obj)
				if forCreate {
					return nil, folderLegacy.ErrInternal.Errorf("unable to read folder ancestry: %w", err)
				}
				info.Items = append(info.Items, folders.FolderInfo{
					Name:        item.Parent,
					Detached:    true,
					Description: err.Error(),
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
