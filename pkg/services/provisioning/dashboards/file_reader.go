package dashboards

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/dashboards"

	"github.com/grafana/grafana/pkg/bus"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
)

var (
	checkDiskForChangesInterval time.Duration = time.Second * 3

	ErrFolderNameMissing error = errors.New("Folder name missing")
)

type fileReader struct {
	Cfg           *DashboardsAsConfig
	Path          string
	log           log.Logger
	dashboardRepo dashboards.Repository
	cache         *dashboardCache
	createWalk    func(fr *fileReader, folderId int64) filepath.WalkFunc
}

func NewDashboardFileReader(cfg *DashboardsAsConfig, log log.Logger) (*fileReader, error) {
	path, ok := cfg.Options["folder"].(string)
	if !ok {
		return nil, fmt.Errorf("Failed to load dashboards. folder param is not a string")
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		log.Error("Cannot read directory", "error", err)
	}

	return &fileReader{
		Cfg:           cfg,
		Path:          path,
		log:           log,
		dashboardRepo: dashboards.GetRepository(),
		cache:         NewDashboardCache(),
		createWalk:    createWalkFn,
	}, nil
}

func (fr *fileReader) ReadAndListen(ctx context.Context) error {
	ticker := time.NewTicker(checkDiskForChangesInterval)

	if err := fr.startWalkingDisk(); err != nil {
		fr.log.Error("failed to search for dashboards", "error", err)
	}

	running := false

	for {
		select {
		case <-ticker.C:
			if !running { // avoid walking the filesystem in parallel. incase fs is very slow.
				running = true
				go func() {
					if err := fr.startWalkingDisk(); err != nil {
						fr.log.Error("failed to search for dashboards", "error", err)
					}
					running = false
				}()
			}
		case <-ctx.Done():
			return nil
		}
	}
}

func (fr *fileReader) startWalkingDisk() error {
	if _, err := os.Stat(fr.Path); err != nil {
		if os.IsNotExist(err) {
			return err
		}
	}

	folderId, err := getOrCreateFolderId(fr.Cfg, fr.dashboardRepo)
	if err != nil && err != ErrFolderNameMissing {
		return err
	}

	return filepath.Walk(fr.Path, fr.createWalk(fr, folderId))
}

func getOrCreateFolderId(cfg *DashboardsAsConfig, repo dashboards.Repository) (int64, error) {
	if cfg.Folder == "" {
		return 0, ErrFolderNameMissing
	}

	cmd := &models.GetDashboardQuery{Slug: models.SlugifyTitle(cfg.Folder), OrgId: cfg.OrgId}
	err := bus.Dispatch(cmd)

	if err != nil && err != models.ErrDashboardNotFound {
		return 0, err
	}

	// dashboard folder not found. create one.
	if err == models.ErrDashboardNotFound {
		dash := &dashboards.SaveDashboardItem{}
		dash.Dashboard = models.NewDashboard(cfg.Folder)
		dash.Dashboard.IsFolder = true
		dash.Overwrite = true
		dash.OrgId = cfg.OrgId
		dbDash, err := repo.SaveDashboard(dash)
		if err != nil {
			return 0, err
		}

		return dbDash.Id, nil
	}

	if !cmd.Result.IsFolder {
		return 0, fmt.Errorf("Got invalid response. Expected folder, found dashboard")
	}

	return cmd.Result.Id, nil
}

func createWalkFn(fr *fileReader, folderId int64) filepath.WalkFunc {
	return func(path string, fileInfo os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if fileInfo.IsDir() {
			if strings.HasPrefix(fileInfo.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}

		if !strings.HasSuffix(fileInfo.Name(), ".json") {
			return nil
		}

		cachedDashboard, exist := fr.cache.getCache(path)
		if exist && cachedDashboard.UpdatedAt == fileInfo.ModTime() {
			return nil
		}

		dash, err := fr.readDashboardFromFile(path, folderId)
		if err != nil {
			fr.log.Error("failed to load dashboard from ", "file", path, "error", err)
			return nil
		}

		// id = 0 indicates ID validation should be avoided before writing to the db.
		dash.Dashboard.Id = 0

		cmd := &models.GetDashboardQuery{Slug: dash.Dashboard.Slug}
		err = bus.Dispatch(cmd)

		// if we dont have the dashboard in the db, save it!
		if err == models.ErrDashboardNotFound {
			fr.log.Debug("saving new dashboard", "file", path)
			_, err = fr.dashboardRepo.SaveDashboard(dash)
			return err
		}

		if err != nil {
			fr.log.Error("failed to query for dashboard", "slug", dash.Dashboard.Slug, "error", err)
			return nil
		}

		// break if db version is newer then fil version
		if cmd.Result.Updated.Unix() >= fileInfo.ModTime().Unix() {
			return nil
		}

		fr.log.Debug("loading dashboard from disk into database.", "file", path)
		_, err = fr.dashboardRepo.SaveDashboard(dash)
		return err
	}
}

func (fr *fileReader) readDashboardFromFile(path string, folderId int64) (*dashboards.SaveDashboardItem, error) {
	reader, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	data, err := simplejson.NewFromReader(reader)
	if err != nil {
		return nil, err
	}

	stat, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	dash, err := createDashboardJson(data, stat.ModTime(), fr.Cfg, folderId)
	if err != nil {
		return nil, err
	}

	fr.cache.addDashboardCache(path, dash)

	return dash, nil
}
