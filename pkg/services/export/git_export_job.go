package export

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type userInfo struct {
	ID    int64  `xorm:"id"`
	Login string `xorm:"login"`
	Email string `xorm:"email"`
	Name  string `xorm:"name"`
}

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
	ctx := context.Background()

	cmd := &models.SearchOrgsQuery{}
	err = e.sql.SearchOrgs(ctx, cmd)
	if err != nil {
		return err
	}

	// Export each org
	for _, org := range cmd.Result {
		rootDir := path.Join(e.rootDir, fmt.Sprintf("org_%d", org.Id))
		err = e.doOrgExportWithHistory(ctx, org.Id, rootDir, w)
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

func (e *gitExportJob) doOrgExportWithHistory(ctx context.Context, orgID int64, baseDir string, w *git.Worktree) error {
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
	users := readusers(ctx, orgID, e.sql)

	rootDir := path.Join(baseDir, "root")
	_ = os.MkdirAll(rootDir, 0750)

	err := e.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
			Where("org_id = ?", orgID).
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

	_ = w.AddGlob("*.json")
	_ = w.AddGlob("*/*.json")
	commit, _ := w.Commit("folder structure", &git.CommitOptions{
		Author: &object.Signature{
			Name:  "John Doe",
			Email: "john@doe.org",
			When:  oldest,
		},
	})
	fmt.Printf("folders: %v\n", commit.String())
	fmt.Printf("ids: %v\n", ids)

	err = e.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
			// Join() for orgid?
			//	Where("org_id = ?", orgID).
			Cols("dashboard_id", "version", "created", "created_by", "message", "data").
			Asc("created")

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

			// ?? remove version, id, and UID?
			clean = cleanDashboardJSON(row.Data)

			dpath := filepath.Join(rootDir, fpath)
			_ = ioutil.WriteFile(dpath, clean, 0644)
			_, _ = w.Add(fpath)

			msg := row.Message
			if msg == "" {
				msg = fmt.Sprintf("Version: %d", row.Version)
			}

			user, ok := users[row.CreatedBy]
			if !ok {
				user = &userInfo{}
			}

			_, _ = w.Commit(msg, &git.CommitOptions{
				Author: &object.Signature{
					Name:  firstRealString(user.Name, user.Login, user.Email, "?"),
					Email: firstRealString(user.Email, user.Login, user.Name, "?"),
					When:  row.Created,
				},
			})

			count++
			fmt.Printf("COMMIT: %d // %s (%d)\n", count, fpath, row.Version)

			e.status.Current = count
			e.status.Last = fpath
			e.status.Changed = time.Now().UnixMilli()
			e.broadcaster(e.status)
		}

		return nil
	})

	return err
}

func firstRealString(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return "?"
}

func readusers(ctx context.Context, orgID int64, sql *sqlstore.SQLStore) map[int64]*userInfo {
	rows := make([]*userInfo, 0)
	_ = sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		sess.Table("user").
			Where("org_id = ?", orgID).
			Cols("id", "login", "email", "name")

		return sess.Find(&rows)
	})

	lookup := make(map[int64]*userInfo, len(rows))
	for _, row := range rows {
		lookup[row.ID] = row
	}
	return lookup
}

/**

// TODO -- initalize on main!! (currently master)
git branch -m master main

git remote add origin git@github.com:ryantxu/test-dash-repo.git
git branch -M main
git push -u origin main

**/
