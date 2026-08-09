package folders

import (
	"context"
	"fmt"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	folderLegacy "github.com/grafana/grafana/pkg/services/folder"
)

type parentsGetter = func(ctx context.Context, folder *folders.Folder) (*folders.FolderInfoList, error)

// newParentsGetter builds the ancestor-chain walker used by the /parents subresource (and by
// folder-move validation). pathVisibilityEnabled gates Phase 1.5 (#2285 §4.5, behind
// featuremgmt.FlagAuthzFolderPathVisibility): off, this is byte-for-byte the pre-Phase-1.5 walk --
// it stops at the first ancestor the caller can't access. On, it keeps walking to the root,
// resolving inaccessible ancestors' names via a privileged, title-only read (see
// getAncestorTitleOnly below) instead of giving up.
func newParentsGetter(getter rest.Getter, maxDepth int, pathVisibilityEnabled bool) parentsGetter {
	return func(ctx context.Context, folder *folders.Folder) (*folders.FolderInfoList, error) {
		info := &folders.FolderInfoList{
			Items: []folders.FolderInfo{},
		}
		id := folder.Name
		if id == folderLegacy.GeneralFolderUID || id == folderLegacy.SharedWithMeFolderUID {
			info.Items = []folders.FolderInfo{{
				Name:    folder.Name,
				Title:   folder.Spec.Title,
				CanView: true,
			}}
			return info, nil
		}

		found := make(map[string]bool)
		found[folder.Name] = true
		var err error
		// detached tracks whether the *current* folder was itself resolved via the privileged
		// title-only read (i.e. the caller can't actually access it) so the item built for it
		// below is correctly flagged as inert/non-browsable context, not a real, navigable node.
		detached := false

		for folder != nil {
			meta, _ := utils.MetaAccessor(folder)
			item := folders.FolderInfo{
				Name:     folder.Name,
				Title:    folder.Spec.Title,
				Parent:   meta.GetFolder(),
				Detached: detached,
				// CanView mirrors Detached: a ghost node (see getAncestorTitleOnly) was never
				// actually authorized for this caller, so it must never claim viewability.
				// CanEdit/CanAdmin/CanDelete are left at their false default for every item here
				// (see the doc comment on FolderInfo) -- accurately computing them would need
				// accessClient plumbed into this walk, which is out of scope for Phase 1.5.
				CanView: !detached,
			}
			if folder.Spec.Description != nil {
				item.Description = *folder.Spec.Description
			}
			info.Items = append(info.Items, item)
			if folderLegacy.IsRootFolderUID(item.Parent) {
				break
			}

			if found[item.Parent] {
				return nil, folderLegacy.ErrCyclicReference.Errorf("cyclic folder references found: %s", item.Parent)
			}

			obj, e2 := getter.Get(ctx, item.Parent, &metav1.GetOptions{})
			if e2 != nil {
				if !pathVisibilityEnabled {
					info.Items = append(info.Items, folders.FolderInfo{
						Name:        item.Parent,
						Detached:    true,
						Description: e2.Error(),
					})
					break
				}

				// Behind the toggle: the caller can't fully access this ancestor, but its name
				// alone is not sensitive information for path-display purposes (epic #2285 §4.5)
				// -- resolve it via the privileged, title-only read instead of stopping the whole
				// walk here. Keep trying the normal, authorized getter.Get at every further
				// level: an ancestor higher up the chain may still be genuinely accessible (e.g.
				// self-read on the root, an inaccessible team folder below it) and must render as
				// a real node, not an inert one, if so.
				ghostFolder, gerr := getAncestorTitleOnly(ctx, getter, item.Parent)
				if gerr != nil {
					info.Items = append(info.Items, folders.FolderInfo{
						Name:        item.Parent,
						Detached:    true,
						Description: gerr.Error(),
					})
					break
				}

				found[ghostFolder.Name] = true
				folder = ghostFolder
				detached = true
				continue
			}

			parentFolder, ok := obj.(*folders.Folder)
			if !ok {
				info.Items = append(info.Items, folders.FolderInfo{
					Name:        item.Parent,
					Detached:    true,
					Description: fmt.Sprintf("expected folder, found: %T", obj),
				})
				break
			}

			found[parentFolder.Name] = true
			folder = parentFolder
			detached = false
		}

		// Start from the root
		slices.Reverse(info.Items)
		return info, err
	}
}

// getAncestorTitleOnly resolves {uid, title, parent, description} for a single ancestor folder
// using a service identity, bypassing the normal per-object folders:read/can_get_self check. This
// is the one deliberate trust boundary Phase 1.5 introduces (epic #2285 §4.5 / issue #2309): a
// folder's bare name is treated as inert path-display context, never as equivalent to real read
// access. Callers must only ever use the returned object to keep the ancestor walk above going
// one more level -- it must never be serialized back to the client as-is, and it must never carry
// anything beyond the four fields a *folders.Folder needs for that walk (no permissions, no
// content, no children).
func getAncestorTitleOnly(ctx context.Context, getter rest.Getter, uid string) (*folders.Folder, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	svcCtx := identity.WithServiceIdentityContext(ctx, requester.GetOrgID())
	obj, err := getter.Get(svcCtx, uid, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	full, ok := obj.(*folders.Folder)
	if !ok {
		return nil, fmt.Errorf("expected folder, found: %T", obj)
	}

	ghost := &folders.Folder{
		ObjectMeta: metav1.ObjectMeta{Name: full.Name},
		Spec:       folders.FolderSpec{Title: full.Spec.Title},
	}
	if full.Spec.Description != nil {
		desc := *full.Spec.Description
		ghost.Spec.Description = &desc
	}

	fullMeta, _ := utils.MetaAccessor(full)
	ghostMeta, _ := utils.MetaAccessor(ghost)
	ghostMeta.SetFolder(fullMeta.GetFolder())

	return ghost, nil
}
