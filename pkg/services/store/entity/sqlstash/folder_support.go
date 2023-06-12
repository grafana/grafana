package sqlstash

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

type folderInfo struct {
	UID  string `json:"uid"`
	Name string `json:"name"` // original display name
	Slug string `json:"slug"` // full slug

	// original slug
	originalSlug string

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
func updateFolderTree(ctx context.Context, tx *session.SessionTx, tenant int64) error {
	_, err := tx.Exec(ctx, "DELETE FROM entity_folder WHERE tenant_id=?", tenant)
	if err != nil {
		return err
	}

	all := []*folderInfo{}
	rows, err := tx.Query(ctx, "SELECT uid,folder,name,slug FROM entity WHERE kind=? AND tenant_id=? ORDER BY slug asc;",
		entity.StandardKindFolder, tenant)
	if err != nil {
		return err
	}
	for rows.Next() {
		folder := folderInfo{
			children: []*folderInfo{},
		}
		err = rows.Scan(&folder.UID, &folder.parentUID, &folder.Name, &folder.originalSlug)
		if err != nil {
			break
		}
		all = append(all, &folder)
	}
	errClose := rows.Close()
	// TODO: Use some kind of multi-error.
	// Until then, we want to prioritize errors coming from the .Scan
	// over those coming from .Close.
	if err != nil {
		return err
	}
	if errClose != nil {
		return errClose
	}

	root, lost, err := buildFolderTree(all)
	if err != nil {
		return err
	}

	err = insertFolderInfo(ctx, tx, tenant, root, false)
	if err != nil {
		return err
	}

	for _, folder := range lost {
		err = insertFolderInfo(ctx, tx, tenant, folder, true)
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
		folder.Slug = "/"
		for _, f := range stack {
			folder.Slug += f.originalSlug + "/"
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

func insertFolderInfo(ctx context.Context, tx *session.SessionTx, tenant int64, folder *folderInfo, isDetached bool) error {
	js, _ := json.Marshal(folder.stack)
	grn := entity.GRN{TenantId: tenant, Kind: entity.StandardKindFolder, UID: folder.UID}
	_, err := tx.Exec(ctx,
		`INSERT INTO entity_folder `+
			"(grn, tenant_id, uid, slug_path, tree, depth, left, right, detached) "+
			`VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		grn.ToGRNString(),
		tenant,
		folder.UID,
		folder.Slug,
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
		err := insertFolderInfo(ctx, tx, tenant, sub, isDetached)
		if err != nil {
			return err
		}
	}
	return nil
}
