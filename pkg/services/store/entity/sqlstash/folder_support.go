package sqlstash

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

type folderInfo struct {
	UID  string `json:"uid"`
	Name string `json:"name"`
	Slug string `json:"slug"`

	// Build the tree
	ParentUID string `json:"-"`

	// Added after query
	children []*folderInfo
	parent   *folderInfo
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
	lookup := make(map[string]*folderInfo)
	rows, err := tx.Query(ctx, "SELECT uid,folder,name,slug FROM entity WHERE kind=? AND tenant_id=? ORDER BY slug asc;",
		models.StandardKindFolder, tenant)
	if err != nil {
		return err
	}
	for rows.Next() {
		folder := folderInfo{
			children: []*folderInfo{},
		}
		err = rows.Scan(&folder.UID, &folder.ParentUID, &folder.Name, &folder.Slug)
		if err != nil {
			return err
		}
		lookup[folder.UID] = &folder
		all = append(all, &folder)
	}
	err = rows.Close()
	if err != nil {
		return err
	}

	root := &folderInfo{
		Name:     "Root",
		children: []*folderInfo{},
	}
	lookup[""] = root
	lost := []*folderInfo{}

	// already sorted by slug
	for _, folder := range all {
		parent, ok := lookup[folder.ParentUID]
		if ok {
			folder.parent = parent
			parent.children = append(parent.children, folder)
		} else {
			lost = append(lost, folder)
		}
	}

	for _, folder := range root.children {
		err = addFolderInfo(ctx, tx, tenant, []*folderInfo{folder}, false)
		if err != nil {
			return err
		}
	}
	for _, folder := range lost {
		err = addFolderInfo(ctx, tx, tenant, []*folderInfo{folder}, true)
		if err != nil {
			return err
		}
	}
	return err
}

func addFolderInfo(ctx context.Context, tx *session.SessionTx, tenant int64, tree []*folderInfo, isDetached bool) error {
	folder := tree[len(tree)-1] // last item in the tree

	js, _ := json.Marshal(tree)
	slugPath := "/"
	for _, f := range tree {
		slugPath += f.Slug + "/"
	}
	grn := entity.GRN{TenantId: tenant, Kind: models.StandardKindFolder, UID: folder.UID}
	_, err := tx.Exec(ctx,
		`INSERT INTO entity_folder `+
			"(grn, tenant_id, uid, slug_path, tree, depth, detached) "+
			`VALUES (?, ?, ?, ?, ?, ?, ?)`,
		grn.ToGRNString(),
		tenant,
		folder.UID,
		slugPath,
		string(js),
		len(tree),
		isDetached,
	)
	if err != nil {
		return err
	}

	for _, sub := range folder.children {
		err := addFolderInfo(ctx, tx, tenant, append(tree, sub), isDetached)
		if err != nil {
			return err
		}
	}
	return nil
}
