package gitops

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/searchV2/extract"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// replace any unsafe file name characters... TODO, but be a standard way to do this cleanly!!!
func cleanFileName(name string) string {
	name = strings.ReplaceAll(name, "/", "-")
	name = strings.ReplaceAll(name, "\\", "-")
	name = strings.ReplaceAll(name, ":", "-")
	return name
}

type dashDataQueryResult struct {
	Id       int64
	IsFolder bool   `xorm:"is_folder"`
	FolderID int64  `xorm:"folder_id"`
	Slug     string `xorm:"slug"`
	Data     []byte
	Created  time.Time
	Updated  time.Time
}

// Utility function to export dashboards
func exportDashboards(ctx context.Context, orgID int64, sql *sqlstore.SQLStore, target string) error {
	// key will allow name or uid
	lookup := func(key string) *extract.DatasourceInfo {
		return nil // TODO!
	}

	err := sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rows := make([]*dashDataQueryResult, 0)

		sess.Table("dashboard").
			Where("org_id = ?", orgID).
			Cols("id", "is_folder", "folder_id", "data", "slug", "created", "updated")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		alias := make(map[string]string, 100)
		ids := make(map[int64]string, 100)
		folders := make(map[int64]string, 100)

		// Process all folders (only one level deep!!!)
		for _, row := range rows {
			if row.IsFolder {
				dash := extract.ReadDashboard(bytes.NewReader(row.Data), lookup)

				slug := cleanFileName(dash.Title)
				fpath := path.Join(target, slug)
				err = os.MkdirAll(fpath, 0750)
				if err != nil {
					return err
				}

				folder := map[string]string{
					"title": dash.Title,
				}

				clean, err := json.MarshalIndent(folder, "", "  ")
				if err != nil {
					return err
				}

				dpath := path.Join(fpath, "__folder.json")
				err = os.WriteFile(dpath, clean, 0600)
				if err != nil {
					return err
				}

				alias[dash.UID] = slug
				folders[row.Id] = slug
			}
		}

		for _, row := range rows {
			if !row.IsFolder {
				var dash map[string]interface{}
				err := json.Unmarshal(row.Data, &dash)
				if err != nil {
					return err
				}
				uid := dash["uid"]
				delete(dash, "id")
				delete(dash, "uid")

				fname := row.Slug + ".json"
				fpath, ok := folders[row.FolderID]
				if ok {
					fpath = path.Join(fpath, fname)
				} else {
					fpath = fname
				}

				clean, err := json.MarshalIndent(dash, "", "  ")
				if err != nil {
					return err
				}

				dpath := path.Join(target, fpath)
				err = os.WriteFile(dpath, clean, 0600)
				if err != nil {
					return err
				}

				// match the times to the database
				_ = os.Chtimes(dpath, row.Created, row.Updated)

				alias[fmt.Sprintf("%v", uid)] = fpath
				ids[row.Id] = fpath
			}
		}

		clean, err := json.MarshalIndent(alias, "", "  ")
		if err != nil {
			return err
		}

		err = os.WriteFile(path.Join(target, "__alias.json"), clean, 0600)
		if err != nil {
			return err
		}

		clean, err = json.MarshalIndent(ids, "", "  ")
		if err != nil {
			return err
		}

		err = os.WriteFile(path.Join(target, "__ids.json"), clean, 0600)
		if err != nil {
			return err
		}

		return err
	})

	return err
}
