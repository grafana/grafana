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
	createWalk    func(fr *fileReader, folderId int64, provisionedDashboards map[string]*models.DashboardProvisioning, filesOnDisk map[string]bool) filepath.WalkFunc
}

func NewDashboardFileReader(cfg *DashboardsAsConfig, log log.Logger) (*fileReader, error) {
	var path string
	path, ok := cfg.Options["path"].(string)
	if !ok {
		path, ok = cfg.Options["folder"].(string)
		if !ok {
			return nil, fmt.Errorf("Failed to load dashboards. path param is not a string")
		}

		log.Warn("[Deprecated] The folder property is deprecated. Please use path instead.")
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
	if err := fr.startWalkingDisk(); err != nil {
		fr.log.Error("failed to search for dashboards", "error", err)
	}

	ticker := time.NewTicker(checkDiskForChangesInterval)

	running := false

	for {
		select {
		case <-ticker.C:
			if !running { // avoid walking the filesystem in parallel. in-case fs is very slow.
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

	byPath, err := getProvisionedDashboardByPath(fr.dashboardRepo, fr.Cfg.Name)
	if err != nil {
		return err
	}

	filesFoundOnDisk := map[string]bool{}

	err = filepath.Walk(fr.Path, fr.createWalk(fr, folderId, byPath, filesFoundOnDisk))

	//delete dashboards without files
	var dashboardToDelete []int64
	for path, provisioningData := range byPath {
		_, existsInDatabase := filesFoundOnDisk[path]
		if !existsInDatabase {
			dashboardToDelete = append(dashboardToDelete, provisioningData.DashboardId)
		}
	}

	for _, dashboardId := range dashboardToDelete {
		fr.log.Debug("deleting provisioned dashboard. missing on disk", "id", dashboardId)
		cmd := &models.DeleteDashboardCommand{OrgId: fr.Cfg.OrgId, Id: dashboardId}
		err := bus.Dispatch(cmd)
		if err != nil {
			return err
		}
	}

	return nil
}

func getProvisionedDashboardByPath(repo dashboards.Repository, name string) (map[string]*models.DashboardProvisioning, error) {
	arr, err := repo.GetProvisionedDashboardData(name)
	if err != nil {
		return nil, err
	}

	byPath := map[string]*models.DashboardProvisioning{}
	for _, pd := range arr {
		byPath[pd.ExternalId] = pd
	}

	return byPath, nil
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
		dash := &dashboards.SaveDashboardDTO{}
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
		return 0, fmt.Errorf("got invalid response. expected folder, found dashboard")
	}

	return cmd.Result.Id, nil
}

func resolveSymlink(fileinfo os.FileInfo, path string) (os.FileInfo, error) {
	checkFilepath, err := filepath.EvalSymlinks(path)
	if path != checkFilepath {
		path = checkFilepath
		fi, err := os.Lstat(checkFilepath)
		if err != nil {
			return nil, err
		}

		return fi, nil
	}

	return fileinfo, err
}

func createWalkFn(fr *fileReader, folderId int64, provisionedDashboards map[string]*models.DashboardProvisioning, filesOnDisk map[string]bool) filepath.WalkFunc {
	return func(path string, fileInfo os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		isValid, err := validateWalkablePath(fileInfo)
		if !isValid {
			return err
		}

		resolvedFileInfo, err := resolveSymlink(fileInfo, path)
		if err != nil {
			return err
		}

		// mark file as provisioned
		filesOnDisk[path] = true

		cachedDashboard, exist := fr.cache.getCache(path)
		if exist && cachedDashboard.UpdatedAt == resolvedFileInfo.ModTime() {
			return nil
		}

		dash, err := fr.readDashboardFromFile(path, folderId)
		if err != nil {
			fr.log.Error("failed to load dashboard from ", "file", path, "error", err)
			return nil
		}

		var dbDashboard *models.Dashboard
		query := &models.GetDashboardQuery{}
		provisionedData, allReadyProvisioned := provisionedDashboards[path]

		if allReadyProvisioned {
			dash.Dashboard.SetId(provisionedData.DashboardId)

			query.Id = provisionedData.DashboardId
		} else {
			if dash.Dashboard.Id != 0 {
				fr.log.Error("Cannot provision dashboard. Please remove the id property from the json file")
				return nil
			}

			query.Slug = dash.Dashboard.Slug
		}

		err = bus.Dispatch(query)
		dbDashboard = query.Result

		// if we don't have the dashboard in the db, save it!
		if err == models.ErrDashboardNotFound {
			fr.log.Debug("saving new dashboard", "file", path)
			err = saveDashboard(fr, path, dash)
			return err
		}

		if err != nil {
			fr.log.Error("failed to query for dashboard", "slug", dash.Dashboard.Slug, "error", err)
			return nil
		}

		// break if db version is newer then fil version
		if dbDashboard.Updated.Unix() >= resolvedFileInfo.ModTime().Unix() {
			return nil
		}

		fr.log.Debug("loading dashboard from disk into database.", "file", path)
		err = saveDashboard(fr, path, dash)

		return err
	}
}

func saveDashboard(fr *fileReader, path string, dash *dashboards.SaveDashboardDTO) error {
	d := &models.DashboardProvisioning{
		ExternalId: path,
		Name:       fr.Cfg.Name,
	}

	_, err := fr.dashboardRepo.SaveProvisionedDashboard(dash, d)
	if err != nil {
		return err
	}

	fr.cache.addDashboardCache(path, dash)
	return nil
}

func validateWalkablePath(fileInfo os.FileInfo) (bool, error) {
	if fileInfo.IsDir() {
		if strings.HasPrefix(fileInfo.Name(), ".") {
			return false, filepath.SkipDir
		}
		return false, nil
	}

	if !strings.HasSuffix(fileInfo.Name(), ".json") {
		return false, nil
	}

	return true, nil
}

func (fr *fileReader) readDashboardFromFile(path string, folderId int64) (*dashboards.SaveDashboardDTO, error) {
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
