package legacy

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func (job *legacyExporter) exportFolders(helper *commitHelper) (map[string]string, error) {
	query := strings.TrimSpace(`
		SELECT folder.uid, folder.title, folder.description, parent_uid, folder.updated, dashboard.updated_by 
			FROM folder
			JOIN dashboard ON folder.uid = dashboard.uid
			WHERE folder.org_id = ?
		`)
	fmt.Printf("QUERY: %s (%d)\b", query, helper.orgID)

	rows, err := job.sql.GetSqlxSession().Query(helper.ctx, query, helper.orgID)
	if err != nil {
		return nil, err
	}

	lookup := make(map[string]*folderInfo, 1000)
	for rows.Next() {
		folder := &folderInfo{}
		err = rows.Scan(&folder.uid,
			&folder.title,
			&folder.description,
			&folder.parent,
			&folder.update,
			&folder.updateBy)
		if err != nil {
			return nil, err
		}

		lookup[folder.uid] = folder
	}

	root := []*folderInfo{}

	// Link all parents
	for _, f := range lookup {
		parent := lookup[f.parent.String]
		if parent == nil {
			root = append(root, f)
		} else {
			parent.children = append(parent.children, f)
		}
	}

	// Write the folders
	folders := make(map[string]string)
	for _, f := range root {
		traverseFolders(helper, f, []string{}, folders)
	}

	return folders, nil
}

func traverseFolders(helper *commitHelper, f *folderInfo, path []string, folders map[string]string) {
	slug := cleanFileName(f.title)

	path = append(path, slug) // slug
	dir := filepath.Join(helper.orgDir, filepath.Join(path...))
	os.MkdirAll(dir, 0600)
	folders[f.uid] = dir

	info := map[string]any{
		"title": f.title,
		"uid":   f.uid,
	}

	helper.add(commitOptions{
		body: []commitBody{{
			fpath: dir + ".json",
			body:  prettyJSON(info),
		}},
		userID: f.updateBy,
		when:   f.update,
	})

	for _, f := range f.children {
		traverseFolders(helper, f, path, folders)
	}
}
