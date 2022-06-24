package export

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func exportDashboards(helper *commitHelper, job *gitExportJob) error {
	// key will allow name or uid
	lookup := func(ref *extract.DataSourceRef) *extract.DataSourceRef {
		if ref == nil || ref.UID == "" {
			return &extract.DataSourceRef{
				UID:  "default.uid",
				Type: "default.type",
			}
		}
		return ref
	}

	oldest := time.Now()
	alias := make(map[string]string, 100)
	ids := make(map[int64]string, 100)
	folders := make(map[int64]string, 100)

	rootDir := path.Join(helper.orgDir, "root")
	_ = os.MkdirAll(rootDir, 0750)

	err := job.sql.WithDbSession(helper.ctx, func(sess *sqlstore.DBSession) error {
		type dashDataQueryResult struct {
			Id       int64
			UID      string `xorm:"uid"`
			IsFolder bool   `xorm:"is_folder"`
			FolderID int64  `xorm:"folder_id"`
			Slug     string `xorm:"slug"`
			Data     []byte
			Created  time.Time
			Updated  time.Time
		}

		rows := make([]*dashDataQueryResult, 0)

		sess.Table("dashboard").
			Where("org_id = ?", helper.orgID).
			Cols("id", "is_folder", "folder_id", "data", "slug", "created", "updated", "uid")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		// Process all folders (only one level deep!!!)
		for _, row := range rows {
			if row.IsFolder {
				dash, err := extract.ReadDashboard(bytes.NewReader(row.Data), lookup)
				if err != nil {
					return err
				}

				slug := cleanFileName(dash.Title)
				fpath := path.Join(rootDir, slug)
				err = os.MkdirAll(fpath, 0750)
				if err != nil {
					return err
				}

				_ = os.Chtimes(fpath, row.Created, row.Updated)

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

				if row.Created.Before(oldest) {
					oldest = row.Created
				}
			} else {
				fname := row.Slug + ".json"
				fpath, ok := folders[row.FolderID]
				if ok {
					fpath = path.Join(fpath, fname)
				} else {
					fpath = fname
				}

				alias[row.UID] = fpath
				ids[row.Id] = fpath
			}
		}
		return err
	})

	if err != nil {
		return err
	}

	clean, err := json.MarshalIndent(alias, "", "  ")
	if err != nil {
		return err
	}

	err = os.WriteFile(path.Join(rootDir, "__alias.json"), clean, 0600)
	if err != nil {
		return err
	}

	clean, err = json.MarshalIndent(ids, "", "  ")
	if err != nil {
		return err
	}

	err = os.WriteFile(path.Join(rootDir, "__ids.json"), clean, 0600)
	if err != nil {
		return err
	}

	_ = helper.work.AddGlob("*.json")
	_ = helper.work.AddGlob("*/*.json")
	commit, _ := helper.work.Commit("folder structure", &git.CommitOptions{
		Author: &object.Signature{
			Name:  "John Doe",
			Email: "john@doe.org",
			When:  oldest,
		},
	})
	fmt.Printf("folders: %v\n", commit.String())
	fmt.Printf("ids: %v\n", ids)

	err = job.sql.WithDbSession(helper.ctx, func(sess *sqlstore.DBSession) error {
		type dashVersionResult struct {
			DashId    int64     `xorm:"dashboard_id"`
			Version   int64     `xorm:"version"`
			Created   time.Time `xorm:"created"`
			CreatedBy int64     `xorm:"created_by"`
			Message   string    `xorm:"message"`
			Data      []byte
		}

		rows := make([]*dashVersionResult, 0, len(ids))

		sess.Table("dashboard_version").
			Join("INNER", "dashboard", "dashboard.id = dashboard_version.dashboard_id").
			Where("org_id = ?", job.orgID).
			Cols("dashboard_version.dashboard_id",
				"dashboard_version.version",
				"dashboard_version.created",
				"dashboard_version.created_by",
				"dashboard_version.message",
				"dashboard_version.data").
			Asc("dashboard_version.created")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		count := int64(0)

		// Process all folders (only one level deep!!!)
		for _, row := range rows {
			fpath, ok := ids[row.DashId]
			if !ok {
				continue
			}

			msg := row.Message
			if msg == "" {
				msg = fmt.Sprintf("Version: %d", row.Version)
			}

			helper.add(commitOptions{
				body: []commitBody{
					{
						fpath: filepath.Join(rootDir, fpath),
						body:  cleanDashboardJSON(row.Data),
					},
				},
				userID:  row.CreatedBy,
				when:    row.Created,
				comment: msg,
			})

			count++
			fmt.Printf("COMMIT: %d // %s (%d)\n", count, fpath, row.Version)

			job.status.Current = count
			job.status.Last = fpath
			job.status.Changed = time.Now().UnixMilli()
			job.broadcaster(job.status)
		}

		return nil
	})

	return err
}

func cleanDashboardJSON(data []byte) []byte {
	var dash map[string]interface{}
	err := json.Unmarshal(data, &dash)
	if err != nil {
		return nil
	}
	delete(dash, "id")
	delete(dash, "uid")
	delete(dash, "version")

	clean, _ := json.MarshalIndent(dash, "", "  ")
	return clean
}

// replace any unsafe file name characters... TODO, but be a standard way to do this cleanly!!!
func cleanFileName(name string) string {
	name = strings.ReplaceAll(name, "/", "-")
	name = strings.ReplaceAll(name, "\\", "-")
	name = strings.ReplaceAll(name, ":", "-")
	return name
}
