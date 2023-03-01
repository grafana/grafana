package export

import (
	"encoding/json"
	"fmt"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
)

func exportDashboards(helper *commitHelper, job *gitExportJob) error {
	alias := make(map[string]string, 100)
	ids := make(map[int64]string, 100)
	folders := make(map[int64]string, 100)

	// Should root files be at the root or in a subfolder called "general"?
	if len(job.cfg.GeneralFolderPath) > 0 {
		folders[0] = job.cfg.GeneralFolderPath // "general"
	}

	lookup, err := dashboard.LoadDatasourceLookup(helper.ctx, helper.orgID, job.sql)
	if err != nil {
		return err
	}

	rootDir := path.Join(helper.orgDir, "drive")
	folderStructure := commitOptions{
		when:    time.Now(),
		comment: "Exported folder structure",
	}

	err = job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
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

		reader := dashboard.NewStaticDashboardSummaryBuilder(lookup, false)

		// Process all folders
		for _, row := range rows {
			if !row.IsFolder {
				continue
			}
			dash, _, err := reader(helper.ctx, row.UID, row.Data)
			if err != nil {
				return err
			}

			dash.UID = row.UID
			slug := cleanFileName(dash.Name)
			folder := map[string]string{
				"title": dash.Name,
			}

			folderStructure.body = append(folderStructure.body, commitBody{
				fpath: path.Join(rootDir, slug, "__folder.json"),
				body:  prettyJSON(folder),
			})

			alias[dash.UID] = slug
			folders[row.Id] = slug

			if row.Created.Before(folderStructure.when) {
				folderStructure.when = row.Created
			}
		}

		// Now process the dashboards in each folder
		for _, row := range rows {
			if row.IsFolder {
				continue
			}
			fname := row.Slug + "-dashboard.json"
			fpath, ok := folders[row.FolderID]
			if ok {
				fpath = path.Join(fpath, fname)
			} else {
				fpath = fname
			}

			alias[row.UID] = fpath
			ids[row.Id] = fpath
		}

		return err
	})
	if err != nil {
		return err
	}

	err = helper.add(folderStructure)
	if err != nil {
		return err
	}

	err = helper.add(commitOptions{
		body: []commitBody{
			{
				fpath: filepath.Join(helper.orgDir, "root-alias.json"),
				body:  prettyJSON(alias),
			},
			{
				fpath: filepath.Join(helper.orgDir, "root-ids.json"),
				body:  prettyJSON(ids),
			},
		},
		when:    folderStructure.when,
		comment: "adding UID alias structure",
	})
	if err != nil {
		return err
	}

	// Now walk the history
	err = job.sql.WithDbSession(helper.ctx, func(sess *db.Session) error {
		type dashVersionResult struct {
			DashId    int64     `xorm:"id"`
			Version   int64     `xorm:"version"`
			Created   time.Time `xorm:"created"`
			CreatedBy int64     `xorm:"created_by"`
			Message   string    `xorm:"message"`
			Data      []byte
		}

		rows := make([]*dashVersionResult, 0, len(ids))

		if job.cfg.KeepHistory {
			sess.Table("dashboard_version").
				Join("INNER", "dashboard", "dashboard.id = dashboard_version.dashboard_id").
				Where("org_id = ?", helper.orgID).
				Cols("dashboard.id",
					"dashboard_version.version",
					"dashboard_version.created",
					"dashboard_version.created_by",
					"dashboard_version.message",
					"dashboard_version.data").
				Asc("dashboard_version.created")
		} else {
			sess.Table("dashboard").
				Where("org_id = ?", helper.orgID).
				Cols("id",
					"version",
					"created",
					"created_by",
					"data").
				Asc("created")
		}

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

			err = helper.add(commitOptions{
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
			if err != nil {
				return err
			}
			count++
			fmt.Printf("COMMIT: %d // %s (%d)\n", count, fpath, row.Version)
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
	if err := filestorage.ValidatePath(filestorage.Delimiter + name); err != nil {
		randomName, _ := uuid.NewRandom()
		return randomName.String()
	}
	return name
}
