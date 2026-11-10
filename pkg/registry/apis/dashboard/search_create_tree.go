package dashboard

import (
	"context"
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
)

// CreatableTree indexes the create-granted folders and the ancestors leading to them.
type CreatableTree struct {
	all      bool
	grants   map[string]struct{}
	children map[string][]string // parent UID ("" for root) -> children on a path to a grant
}

func BuildCreatableTree(ctx context.Context, svc folder.Service, orgID int64, grants CreateGrants) (*CreatableTree, error) {
	t := &CreatableTree{all: grants.All, grants: make(map[string]struct{}, len(grants.UIDs)), children: map[string][]string{}}
	uids := make([]string, 0, len(grants.UIDs))
	for _, uid := range grants.UIDs {
		t.grants[uid] = struct{}{}
		if !folder.IsRootFolderUID(uid) {
			uids = append(uids, uid)
		}
	}
	if len(uids) == 0 {
		return t, nil
	}

	folders, err := folderPaths(ctx, svc, orgID, uids)
	if err != nil {
		return nil, err
	}
	linked := map[string]struct{}{}
	for _, f := range folders {
		parent := ""
		for uid := range strings.SplitSeq(f.FullpathUIDs, "/") {
			if _, ok := linked[parent+"/"+uid]; !ok {
				linked[parent+"/"+uid] = struct{}{}
				t.children[parent] = append(t.children[parent], uid)
			}
			parent = uid
		}
	}
	for _, c := range t.children {
		slices.Sort(c)
	}
	return t, nil
}

func (t *CreatableTree) Inherited(path []string) bool {
	return t.all || slices.ContainsFunc(path, t.IsGrant)
}

func (t *CreatableTree) IsGrant(uid string) bool {
	_, ok := t.grants[uid]
	return ok
}

func (t *CreatableTree) Children(parent string) []string {
	if folder.IsRootFolderUID(parent) {
		parent = ""
	}
	return t.children[parent]
}

// FolderPath returns the root-first UIDs down to the folder, or nil if it is not found.
func FolderPath(ctx context.Context, svc folder.Service, orgID int64, uid string) ([]string, error) {
	if folder.IsRootFolderUID(uid) {
		return []string{folder.GeneralFolderUID}, nil
	}
	folders, err := folderPaths(ctx, svc, orgID, []string{uid})
	if err != nil || len(folders) == 0 {
		return nil, err
	}
	return strings.Split(folders[0].FullpathUIDs, "/"), nil
}

// folderPaths runs as a service identity so create-only folders, which the user cannot read, are not dropped.
func folderPaths(ctx context.Context, svc folder.Service, orgID int64, uids []string) ([]*folder.Folder, error) {
	ctx, requester := identity.WithServiceIdentity(ctx, orgID)
	return svc.GetFolders(ctx, folder.GetFoldersQuery{
		OrgID:            orgID,
		UIDs:             uids,
		WithFullpathUIDs: true,
		MetadataOnly:     true,
		SignedInUser:     requester,
	})
}
