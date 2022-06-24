package export

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/go-git/go-git/v5"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
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

var _ Job = new(gitExportJob)

type gitExportJob struct {
	logger  log.Logger
	sql     *sqlstore.SQLStore
	orgID   int64
	rootDir string

	statusMu    sync.Mutex
	status      ExportStatus
	cfg         ExportConfig
	broadcaster statusBroadcaster
}

func startGitExportJob(cfg ExportConfig, sql *sqlstore.SQLStore, rootDir string, orgID int64, broadcaster statusBroadcaster) (Job, error) {
	job := &gitExportJob{
		logger:      log.New("git_export_job"),
		cfg:         cfg,
		sql:         sql,
		orgID:       orgID,
		rootDir:     rootDir,
		broadcaster: broadcaster,
		status: ExportStatus{
			Running: true,
			Target:  "git export",
			Started: time.Now().UnixMilli(),
			Current: 0,
		},
	}

	broadcaster(job.status)
	go job.start()
	return job, nil
}

func (e *gitExportJob) getStatus() ExportStatus {
	e.statusMu.Lock()
	defer e.statusMu.Unlock()

	return e.status
}

func (e *gitExportJob) getConfig() ExportConfig {
	e.statusMu.Lock()
	defer e.statusMu.Unlock()

	return e.cfg
}

// Utility function to export dashboards
func (e *gitExportJob) start() {
	defer func() {
		e.logger.Info("Finished git export job")

		e.statusMu.Lock()
		defer e.statusMu.Unlock()
		s := e.status
		if err := recover(); err != nil {
			e.logger.Error("export panic", "error", err)
			s.Status = fmt.Sprintf("ERROR: %v", err)
		}
		// Make sure it finishes OK
		if s.Finished < 10 {
			s.Finished = time.Now().UnixMilli()
		}
		s.Running = false
		if s.Status == "" {
			s.Status = "done"
		}
		s.Target = e.rootDir
		e.status = s
		e.broadcaster(s)
	}()

	if true {
		err := e.doExportWithHistory()
		if err != nil {
			e.logger.Error("ERROR", "e", err)
		}
	} else {
		e.doFlatExport()
	}
}

func (e *gitExportJob) doFlatExport() {
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

	target := e.rootDir
	ctx := context.Background()
	sql := e.sql

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

	err := sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rows := make([]*dashDataQueryResult, 0)

		sess.Table("dashboard").
			Where("org_id = ?", e.orgID).
			Cols("id", "uid", "is_folder", "folder_id", "data", "slug", "created", "updated")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		return err
	})
	if err != nil {
		e.status.Status = "ERROR"
		e.logger.Error("ERROR running", "err", err)
	}

	err = sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rows := make([]*dashDataQueryResult, 0)

		sess.Table("dashboard").
			Where("org_id = ?", e.orgID).
			Cols("id", "uid", "is_folder", "folder_id", "data", "slug", "created", "updated")

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
				dash, err := extract.ReadDashboard(bytes.NewReader(row.Data), lookup)
				if err != nil {
					return err
				}

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
				fname := row.Slug + ".json"
				fpath, ok := folders[row.FolderID]
				if ok {
					fpath = path.Join(fpath, fname)
				} else {
					fpath = fname
				}

				clean := cleanDashboardJSON(row.Data)

				dpath := path.Join(target, fpath)
				err = os.WriteFile(dpath, clean, 0600)
				if err != nil {
					return err
				}

				// match the times to the database
				_ = os.Chtimes(dpath, row.Created, row.Updated)

				alias[fmt.Sprintf("%v", row.UID)] = fpath
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

	if err != nil {
		e.status.Status = "ERROR"
		e.logger.Error("ERROR running", "err", err)
	}
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

func (e *gitExportJob) doExportWithHistory() error {
	r, err := git.PlainInit(e.rootDir, false)
	if err != nil {
		return err
	}
	w, err := r.Worktree()
	if err != nil {
		return err
	}
	helper := &commitHelper{
		repo: r,
		work: w,
		ctx:  context.Background(),
	}

	cmd := &models.SearchOrgsQuery{}
	err = e.sql.SearchOrgs(helper.ctx, cmd)
	if err != nil {
		return err
	}

	// Export each org
	for _, org := range cmd.Result {
		helper.baseDir = path.Join(e.rootDir, fmt.Sprintf("org_%d", org.Id))
		err = helper.initOrg(e.sql, org.Id)
		if err != nil {
			return err
		}

		err = e.doOrgExportWithHistory(helper)
		if err != nil {
			return err
		}
	}

	// cleanup the folder
	e.status.Target = "pruning..."
	e.broadcaster(e.status)
	r.Prune(git.PruneOptions{})

	// TODO
	// git gc --prune=now --aggressive

	return nil
}

func (e *gitExportJob) doOrgExportWithHistory(helper *commitHelper) error {
	err := exportUsers(helper, e)
	if err != nil {
		return err
	}

	err = exportDashboards(helper, e)
	if err != nil {
		return err
	}

	return err
}

/**

// TODO -- initalize on main!! (currently master)
git branch -m master main

git remote add origin git@github.com:ryantxu/test-dash-repo.git
git branch -M main
git push -u origin main

**/
