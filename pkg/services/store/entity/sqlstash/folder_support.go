package sqlstash

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

type folderInfo struct {
	Guid string `json:"guid"`

	UID      string `json:"uid"`
	Name     string `json:"name"` // original display name
	SlugPath string `json:"slug"` // full slug path

	// original slug
	Slug string `json:"-"`

	depth int32
	left  int32
	right int32

	// Build the tree
	parentUID string

	// Calculated after query
	parent   *folderInfo
	children []*folderInfo
	stack    []*folderInfo
}

// This will replace all entries in `entity_folder`
// This is pretty heavy weight, but it does give us a sorted folder list
// NOTE: this could be done async with a mutex/lock?  reconciler pattern
func updateFolderTree(ctx context.Context, tx *session.SessionTx, tenantId int64) error {
	_, err := tx.Exec(ctx, "DELETE FROM entity_folder WHERE tenant_id=?", tenantId)
	if err != nil {
		return err
	}

	query := "SELECT guid,uid,folder,name,slug" +
		" FROM entity" +
		" WHERE kind=? AND tenant_id=?" +
		" ORDER BY slug asc"
	args := []interface{}{entity.StandardKindFolder, tenantId}

	all := []*folderInfo{}
	rows, err := tx.Query(ctx, query, args...)
	if err != nil {
		return err
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		folder := folderInfo{
			children: []*folderInfo{},
		}
		err = rows.Scan(&folder.Guid, &folder.UID, &folder.parentUID, &folder.Name, &folder.Slug)
		if err != nil {
			return err
		}
		all = append(all, &folder)
	}

	root, lost, err := buildFolderTree(all)
	if err != nil {
		return err
	}

	err = insertFolderInfo(ctx, tx, tenantId, root, false)
	if err != nil {
		return err
	}

	for _, folder := range lost {
		err = insertFolderInfo(ctx, tx, tenantId, folder, true)
		if err != nil {
			return err
		}
	}
	return err
}

func buildFolderTree(all []*folderInfo) (*folderInfo, []*folderInfo, error) {
	lost := []*folderInfo{}
	lookup := make(map[string]*folderInfo)
	for _, folder := range all {
		lookup[folder.UID] = folder
	}

	root := &folderInfo{
		Name:     "Root",
		UID:      "",
		children: []*folderInfo{},
		left:     1,
	}
	lookup[""] = root

	// already sorted by slug
	for _, folder := range all {
		parent, ok := lookup[folder.parentUID]
		if ok {
			folder.parent = parent
			parent.children = append(parent.children, folder)
		} else {
			lost = append(lost, folder)
		}
	}

	_, err := setMPTTOrder(root, []*folderInfo{}, int32(1))
	return root, lost, err
}

// https://imrannazar.com/Modified-Preorder-Tree-Traversal
func setMPTTOrder(folder *folderInfo, stack []*folderInfo, idx int32) (int32, error) {
	var err error
	folder.depth = int32(len(stack))
	folder.left = idx
	folder.stack = stack

	if folder.depth > 0 {
		folder.SlugPath = "/"
		for _, f := range stack {
			folder.SlugPath += f.Slug + "/"
		}
	}

	for _, child := range folder.children {
		idx, err = setMPTTOrder(child, append(stack, child), idx+1)
		if err != nil {
			return idx, err
		}
	}
	folder.right = idx + 1
	return folder.right, nil
}

func insertFolderInfo(ctx context.Context, tx *session.SessionTx, tenantId int64, folder *folderInfo, isDetached bool) error {
	js, _ := json.Marshal(folder.stack)
	_, err := tx.Exec(ctx,
		`INSERT INTO entity_folder `+
			"(guid, tenant_id, uid, slug_path, tree, depth, lft, rgt, detached) "+
			`VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		folder.Guid,
		tenantId,
		folder.UID,
		folder.SlugPath,
		string(js),
		folder.depth,
		folder.left,
		folder.right,
		isDetached,
	)
	if err != nil {
		return err
	}

	for _, sub := range folder.children {
		err := insertFolderInfo(ctx, tx, tenantId, sub, isDetached)
		if err != nil {
			return err
		}
	}
	return nil
}
