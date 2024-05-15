package sqlstash

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
)

type folderInfo struct {
	GUID string `json:"guid"`

	UID      string `json:"uid"`
	Name     string `json:"name"` // original display name
	SlugPath string `json:"slug"` // full slug path

	// original slug
	Slug string `json:"-"`

	depth int32
	left  int32
	right int32

	// Build the tree
	ParentUID string

	// Calculated after query
	parent   *folderInfo
	children []*folderInfo
	stack    []*folderInfo
}

func (fi *folderInfo) buildInsertItems(items *[]*sqlEntityFolderInsertRequestItem, namespace string, isLost bool) error {
	var js strings.Builder
	if err := json.NewEncoder(&js).Encode(fi.stack); err != nil {
		return fmt.Errorf("marshal stack of folder %q to JSON: %w", fi.SlugPath, err)
	}

	*items = append(*items, &sqlEntityFolderInsertRequestItem{
		GUID:      fi.GUID,
		Namespace: namespace,
		UID:       fi.UID,
		SlugPath:  fi.SlugPath,
		JS:        js.String(),
		Depth:     fi.depth,
		Left:      fi.left,
		Right:     fi.right,
		Detached:  isLost,
	})

	for _, sub := range fi.children {
		if err := sub.buildInsertItems(items, namespace, isLost); err != nil {
			return nil
		}
	}

	return nil
}

// This rebuilds the whole folders structure for a given namespace. This has to
// be done each time an entity is created or deleted.
// FIXME: This is very inefficient and time consuming. This could be implemented
// with a different approach instead of MPTT, or at least mitigated by an async
// job?
// FIXME: This algorithm apparently allows lost trees which are called
// "detached"? We should probably migrate to something safer.
func (s *sqlEntityServer) updateFolderTree(tx db.Tx, namespace string) error {
	_, err := tx.Exec("DELETE FROM entity_folder WHERE namespace=?", namespace)
	if err != nil {
		return fmt.Errorf("clear entity_folder for namespace %q: %w", namespace, err)
	}

	listReq := sqlEntityListFolderElementsRequest{
		SQLTemplate: sqltemplate.New(s.sqlDialect),
		Group:       folder.GROUP,
		Resource:    folder.RESOURCE,
		Namespace:   namespace,
		FolderInfo:  new(folderInfo),
	}
	query, err := sqltemplate.Execute(sqlEntityListFolderElements, listReq)
	if err != nil {
		return fmt.Errorf("execute SQL template to list folder items in namespace %q: %w", namespace, err)
	}

	rows, err := tx.Query(query, listReq.GetArgs()...)
	if err != nil {
		return fmt.Errorf("list folder items in namespace %q: %w", namespace, err)
	}

	var itemList []*folderInfo
	for i := 1; rows.Next(); i++ {
		if err := rows.Scan(listReq.GetScanDest()...); err != nil {
			return fmt.Errorf("scan row #%d listing folder items in namespace %q: %w", i, namespace, err)
		}
		fi := *listReq.FolderInfo
		itemList = append(itemList, &fi)
	}

	if err := rows.Close(); err != nil {
		return fmt.Errorf("close rows after listing folder items in namespace %q: %w", namespace, err)
	}

	root, lost, err := buildFolderTree(itemList)
	if err != nil {
		return fmt.Errorf("build folder tree for namespace %q: %w", namespace, err)
	}

	var insertItems []*sqlEntityFolderInsertRequestItem
	if err = root.buildInsertItems(&insertItems, namespace, false); err != nil {
		return fmt.Errorf("build insert items for root tree in namespace %q: %w", namespace, err)
	}

	for i, lostItem := range lost {
		if err = lostItem.buildInsertItems(&insertItems, namespace, false); err != nil {
			return fmt.Errorf("build insert items for lost folder #%d tree in namespace %q: %w", i, namespace, err)
		}
	}

	insReq := sqlEntityFolderInsertRequest{
		SQLTemplate: sqltemplate.New(s.sqlDialect),
		Items:       insertItems,
	}
	if _, err = tmplDBExec(tx, sqlEntityFolderInsert, insReq); err != nil {
		return fmt.Errorf("insert rebuilt tree for namespace %q: %w", namespace, err)
	}

	return nil
}

func (s *sqlEntityServer) oldUpdateFolderTree(ctx context.Context, tx *session.SessionTx, namespace string) error {
	_, err := tx.Exec(ctx, "DELETE FROM entity_folder WHERE namespace=?", namespace)
	if err != nil {
		return err
	}

	query := "SELECT guid,name,folder,name,slug" +
		" FROM entity" +
		" WHERE " + s.dialect.Quote("group") + "=? AND resource=? AND namespace=?" +
		" ORDER BY slug asc"
	args := []interface{}{folder.GROUP, folder.RESOURCE, namespace}

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
		err = rows.Scan(&folder.GUID, &folder.UID, &folder.ParentUID, &folder.Name, &folder.Slug)
		if err != nil {
			return err
		}
		all = append(all, &folder)
	}

	root, lost, err := buildFolderTree(all)
	if err != nil {
		return err
	}

	err = insertFolderInfo(ctx, tx, namespace, root, false)
	if err != nil {
		return err
	}

	for _, folder := range lost {
		err = insertFolderInfo(ctx, tx, namespace, folder, true)
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
		parent, ok := lookup[folder.ParentUID]
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

func insertFolderInfo(ctx context.Context, tx *session.SessionTx, namespace string, folder *folderInfo, isDetached bool) error {
	js, _ := json.Marshal(folder.stack)
	_, err := tx.Exec(ctx,
		`INSERT INTO entity_folder `+
			"(guid, namespace, name, slug_path, tree, depth, lft, rgt, detached) "+
			`VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		folder.GUID,
		namespace,
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
		err := insertFolderInfo(ctx, tx, namespace, sub, isDetached)
		if err != nil {
			return err
		}
	}
	return nil
}
