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

	provisionedDashboardRefs, err := getProvisionedDashboardByPath(fr.dashboardRepo, fr.Cfg.Name)
	if err != nil {
		return err
	}

	filesFoundOnDisk := map[string]os.FileInfo{}
	err = filepath.Walk(fr.Path, createWalkFn(filesFoundOnDisk))
	if err != nil {
		return err
	}

	// find dashboards to delete since json file is missing
	var dashboardToDelete []int64
	for path, provisioningData := range provisionedDashboardRefs {
		_, existsOnDisk := filesFoundOnDisk[path]
		if !existsOnDisk {
			dashboardToDelete = append(dashboardToDelete, provisioningData.DashboardId)
		}
	}

	// delete dashboard that are missing json file
	for _, dashboardId := range dashboardToDelete {
		fr.log.Debug("deleting provisioned dashboard. missing on disk", "id", dashboardId)
		cmd := &models.DeleteDashboardCommand{OrgId: fr.Cfg.OrgId, Id: dashboardId}
		err := bus.Dispatch(cmd)
		if err != nil {
			fr.log.Error("failed to delete dashboard", "id", cmd.Id)
		}
	}

	sanityChecker := newProvisioningSanityChecker(fr.Cfg.Name)

	// save dashboards based on json files
	for path, fileInfo := range filesFoundOnDisk {
		provisioningMetadata, err := fr.saveDashboard(path, folderId, fileInfo, provisionedDashboardRefs)
		sanityChecker.track(provisioningMetadata)
		if err != nil {
			fr.log.Error("failed to save dashboard", "error", err)
		}
	}
	sanityChecker.logWarnings(fr.log)

	return nil
}

func (fr *fileReader) saveDashboard(path string, folderId int64, fileInfo os.FileInfo, provisionedDashboardRefs map[string]*models.DashboardProvisioning) (provisioningMetadata, error) {
	provisioningMetadata := provisioningMetadata{}
	resolvedFileInfo, err := resolveSymlink(fileInfo, path)
	if err != nil {
		return provisioningMetadata, err
	}

	provisionedData, alreadyProvisioned := provisionedDashboardRefs[path]
	upToDate := alreadyProvisioned && provisionedData.Updated.Unix() == resolvedFileInfo.ModTime().Unix()

	dash, err := fr.readDashboardFromFile(path, resolvedFileInfo.ModTime(), folderId)
	if err != nil {
		fr.log.Error("failed to load dashboard from ", "file", path, "error", err)
		return provisioningMetadata, nil
	}

	// keeps track of what uid's and title's we have already provisioned
	provisioningMetadata.uid = dash.Dashboard.Uid
	provisioningMetadata.title = dash.Dashboard.Title

	if upToDate {
		return provisioningMetadata, nil
	}

	if dash.Dashboard.Id != 0 {
		fr.log.Error("provisioned dashboard json files cannot contain id")
		return provisioningMetadata, nil
	}

	if alreadyProvisioned {
		dash.Dashboard.SetId(provisionedData.DashboardId)
	}

	fr.log.Debug("saving new dashboard", "file", path)
	dp := &models.DashboardProvisioning{ExternalId: path, Name: fr.Cfg.Name, Updated: resolvedFileInfo.ModTime()}
	_, err = fr.dashboardRepo.SaveProvisionedDashboard(dash, dp)
	return provisioningMetadata, err
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

func createWalkFn(filesOnDisk map[string]os.FileInfo) filepath.WalkFunc {
	return func(path string, fileInfo os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		isValid, err := validateWalkablePath(fileInfo)
		if !isValid {
			return err
		}

		filesOnDisk[path] = fileInfo
		return nil
	}
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

func (fr *fileReader) readDashboardFromFile(path string, lastModified time.Time, folderId int64) (*dashboards.SaveDashboardDTO, error) {
	reader, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	data, err := simplejson.NewFromReader(reader)
	if err != nil {
		return nil, err
	}

	dash, err := createDashboardJson(data, lastModified, fr.Cfg, folderId)
	if err != nil {
		return nil, err
	}

	return dash, nil
}

type provisioningMetadata struct {
	uid   string
	title string
}

func newProvisioningSanityChecker(provisioningProvider string) provisioningSanityChecker {
	return provisioningSanityChecker{
		provisioningProvider: provisioningProvider,
		uidUsage:             map[string]uint8{},
		titleUsage:           map[string]uint8{}}
}

type provisioningSanityChecker struct {
	provisioningProvider string
	uidUsage             map[string]uint8
	titleUsage           map[string]uint8
}

func (checker provisioningSanityChecker) track(pm provisioningMetadata) {
	if len(pm.uid) > 0 {
		checker.uidUsage[pm.uid] += 1
	}
	if len(pm.title) > 0 {
		checker.titleUsage[pm.title] += 1
	}

}

func (checker provisioningSanityChecker) logWarnings(log log.Logger) {
	for uid, times := range checker.uidUsage {
		if times > 1 {
			log.Error("the same 'uid' is used more than once", "uid", uid, "provider", checker.provisioningProvider)
		}
	}

	for title, times := range checker.titleUsage {
		if times > 1 {
			log.Error("the same 'title' is used more than once", "title", title, "provider", checker.provisioningProvider)
		}
	}

}
