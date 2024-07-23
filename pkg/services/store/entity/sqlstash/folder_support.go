package sqlstash

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
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
func (s *sqlEntityServer) updateFolderTree(ctx context.Context, x db.ContextExecer, namespace string) error {
	_, err := x.ExecContext(ctx, "DELETE FROM entity_folder WHERE namespace=?", namespace)
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

	rows, err := x.QueryContext(ctx, query, listReq.GetArgs()...)
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

	if err := rows.Err(); err != nil {
		return fmt.Errorf("rows error after listing folder items in namespace %q: %w", namespace, err)
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
	if _, err = exec(ctx, x, sqlEntityFolderInsert, insReq); err != nil {
		return fmt.Errorf("insert rebuilt tree for namespace %q: %w", namespace, err)
	}

	return nil
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
