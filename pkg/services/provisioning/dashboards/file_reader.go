package dashboards

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/util"
)

var (
	// ErrFolderNameMissing is returned when folder name is missing.
	ErrFolderNameMissing = errors.New("Folder name missing")
)

// FileReader is responsible for reading dashboards from disc and
// insert/update dashboards to the Grafana database using
// `dashboards.DashboardProvisioningService`
type FileReader struct {
	Cfg                          *config
	Path                         string
	log                          log.Logger
	dashboardProvisioningService dashboards.DashboardProvisioningService
	FoldersFromFilesStructure    bool
}

// NewDashboardFileReader returns a new filereader based on `config`
func NewDashboardFileReader(cfg *config, log log.Logger) (*FileReader, error) {
	var path string
	path, ok := cfg.Options["path"].(string)
	if !ok {
		path, ok = cfg.Options["folder"].(string)
		if !ok {
			return nil, fmt.Errorf("Failed to load dashboards. path param is not a string")
		}

		log.Warn("[Deprecated] The folder property is deprecated. Please use path instead.")
	}

	foldersFromFilesStructure, _ := cfg.Options["foldersFromFilesStructure"].(bool)
	if foldersFromFilesStructure && cfg.Folder != "" && cfg.FolderUID != "" {
		return nil, fmt.Errorf("'folder' and 'folderUID' should be empty using 'foldersFromFilesStructure' option")
	}

	return &FileReader{
		Cfg:                          cfg,
		Path:                         path,
		log:                          log,
		dashboardProvisioningService: dashboards.NewProvisioningService(),
		FoldersFromFilesStructure:    foldersFromFilesStructure,
	}, nil
}

// pollChanges periodically runs startWalkingDisk based on interval specified in the config.
func (fr *FileReader) pollChanges(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(int64(time.Second) * fr.Cfg.UpdateIntervalSeconds))
	for {
		select {
		case <-ticker.C:
			if err := fr.startWalkingDisk(); err != nil {
				fr.log.Error("failed to search for dashboards", "error", err)
			}
		case <-ctx.Done():
			return
		}
	}
}

// startWalkingDisk traverses the file system for defined path, reads dashboard definition files and applies any change
// to the database.
func (fr *FileReader) startWalkingDisk() error {
	fr.log.Debug("Start walking disk", "path", fr.Path)
	resolvedPath := fr.resolvedPath()
	if _, err := os.Stat(resolvedPath); err != nil {
		return err
	}

	provisionedDashboardRefs, err := getProvisionedDashboardByPath(fr.dashboardProvisioningService, fr.Cfg.Name)
	if err != nil {
		return err
	}

	filesFoundOnDisk := map[string]os.FileInfo{}
	err = filepath.Walk(resolvedPath, createWalkFn(filesFoundOnDisk))
	if err != nil {
		return err
	}

	fr.handleMissingDashboardFiles(provisionedDashboardRefs, filesFoundOnDisk)

	sanityChecker := newProvisioningSanityChecker(fr.Cfg.Name)

	if fr.FoldersFromFilesStructure {
		err = fr.storeDashboardsInFoldersFromFileStructure(filesFoundOnDisk, provisionedDashboardRefs, resolvedPath, &sanityChecker)
	} else {
		err = fr.storeDashboardsInFolder(filesFoundOnDisk, provisionedDashboardRefs, &sanityChecker)
	}
	if err != nil {
		return err
	}

	sanityChecker.logWarnings(fr.log)

	return nil
}

// storeDashboardsInFolder saves dashboards from the filesystem on disk to the folder from config
func (fr *FileReader) storeDashboardsInFolder(filesFoundOnDisk map[string]os.FileInfo, dashboardRefs map[string]*models.DashboardProvisioning, sanityChecker *provisioningSanityChecker) error {
	folderID, err := getOrCreateFolderID(fr.Cfg, fr.dashboardProvisioningService, fr.Cfg.Folder)

	if err != nil && err != ErrFolderNameMissing {
		return err
	}

	// save dashboards based on json files
	for path, fileInfo := range filesFoundOnDisk {
		provisioningMetadata, err := fr.saveDashboard(path, folderID, fileInfo, dashboardRefs)
		sanityChecker.track(provisioningMetadata)
		if err != nil {
			fr.log.Error("failed to save dashboard", "error", err)
		}
	}
	return nil
}

// storeDashboardsInFoldersFromFilesystemStructure saves dashboards from the filesystem on disk to the same folder
// in grafana as they are in on the filesystem
func (fr *FileReader) storeDashboardsInFoldersFromFileStructure(filesFoundOnDisk map[string]os.FileInfo, dashboardRefs map[string]*models.DashboardProvisioning, resolvedPath string, sanityChecker *provisioningSanityChecker) error {
	for path, fileInfo := range filesFoundOnDisk {
		folderName := ""

		dashboardsFolder := filepath.Dir(path)
		if dashboardsFolder != resolvedPath {
			folderName = filepath.Base(dashboardsFolder)
		}

		folderID, err := getOrCreateFolderID(fr.Cfg, fr.dashboardProvisioningService, folderName)
		if err != nil && err != ErrFolderNameMissing {
			return fmt.Errorf("can't provision folder %q from file system structure: %w", folderName, err)
		}

		provisioningMetadata, err := fr.saveDashboard(path, folderID, fileInfo, dashboardRefs)
		sanityChecker.track(provisioningMetadata)
		if err != nil {
			fr.log.Error("failed to save dashboard", "error", err)
		}
	}
	return nil
}

// handleMissingDashboardFiles will unprovision or delete dashboards which are missing on disk.
func (fr *FileReader) handleMissingDashboardFiles(provisionedDashboardRefs map[string]*models.DashboardProvisioning, filesFoundOnDisk map[string]os.FileInfo) {
	// find dashboards to delete since json file is missing
	var dashboardToDelete []int64
	for path, provisioningData := range provisionedDashboardRefs {
		_, existsOnDisk := filesFoundOnDisk[path]
		if !existsOnDisk {
			dashboardToDelete = append(dashboardToDelete, provisioningData.DashboardId)
		}
	}

	if fr.Cfg.DisableDeletion {
		// If deletion is disabled for the provisioner we just remove provisioning metadata about the dashboard
		// so afterwards the dashboard is considered unprovisioned.
		for _, dashboardID := range dashboardToDelete {
			fr.log.Debug("unprovisioning provisioned dashboard. missing on disk", "id", dashboardID)
			err := fr.dashboardProvisioningService.UnprovisionDashboard(dashboardID)
			if err != nil {
				fr.log.Error("failed to unprovision dashboard", "dashboard_id", dashboardID, "error", err)
			}
		}
	} else {
		// delete dashboard that are missing json file
		for _, dashboardID := range dashboardToDelete {
			fr.log.Debug("deleting provisioned dashboard. missing on disk", "id", dashboardID)
			err := fr.dashboardProvisioningService.DeleteProvisionedDashboard(dashboardID, fr.Cfg.OrgID)
			if err != nil {
				fr.log.Error("failed to delete dashboard", "id", dashboardID, "error", err)
			}
		}
	}
}

// saveDashboard saves or updates the dashboard provisioning file at path.
func (fr *FileReader) saveDashboard(path string, folderID int64, fileInfo os.FileInfo, provisionedDashboardRefs map[string]*models.DashboardProvisioning) (provisioningMetadata, error) {
	provisioningMetadata := provisioningMetadata{}
	resolvedFileInfo, err := resolveSymlink(fileInfo, path)
	if err != nil {
		return provisioningMetadata, err
	}

	provisionedData, alreadyProvisioned := provisionedDashboardRefs[path]
	upToDate := alreadyProvisioned && provisionedData.Updated >= resolvedFileInfo.ModTime().Unix()

	jsonFile, err := fr.readDashboardFromFile(path, resolvedFileInfo.ModTime(), folderID)
	if err != nil {
		fr.log.Error("failed to load dashboard from ", "file", path, "error", err)
		return provisioningMetadata, nil
	}

	if provisionedData != nil && jsonFile.checkSum == provisionedData.CheckSum {
		upToDate = true
	}

	// keeps track of what uid's and title's we have already provisioned
	dash := jsonFile.dashboard
	provisioningMetadata.uid = dash.Dashboard.Uid
	provisioningMetadata.identity = dashboardIdentity{title: dash.Dashboard.Title, folderID: dash.Dashboard.FolderId}

	if upToDate {
		return provisioningMetadata, nil
	}

	if dash.Dashboard.Id != 0 {
		dash.Dashboard.Data.Set("id", nil)
		dash.Dashboard.Id = 0
	}

	if alreadyProvisioned {
		dash.Dashboard.SetId(provisionedData.DashboardId)
	}

	fr.log.Debug("saving new dashboard", "provisioner", fr.Cfg.Name, "file", path, "folderId", dash.Dashboard.FolderId)
	dp := &models.DashboardProvisioning{
		ExternalId: path,
		Name:       fr.Cfg.Name,
		Updated:    resolvedFileInfo.ModTime().Unix(),
		CheckSum:   jsonFile.checkSum,
	}

	_, err = fr.dashboardProvisioningService.SaveProvisionedDashboard(dash, dp)
	return provisioningMetadata, err
}

func getProvisionedDashboardByPath(service dashboards.DashboardProvisioningService, name string) (map[string]*models.DashboardProvisioning, error) {
	arr, err := service.GetProvisionedDashboardData(name)
	if err != nil {
		return nil, err
	}

	byPath := map[string]*models.DashboardProvisioning{}
	for _, pd := range arr {
		byPath[pd.ExternalId] = pd
	}

	return byPath, nil
}

func getOrCreateFolderID(cfg *config, service dashboards.DashboardProvisioningService, folderName string) (int64, error) {
	if folderName == "" {
		return 0, ErrFolderNameMissing
	}

	cmd := &models.GetDashboardQuery{Slug: models.SlugifyTitle(folderName), OrgId: cfg.OrgID}
	err := bus.Dispatch(cmd)

	if err != nil && err != models.ErrDashboardNotFound {
		return 0, err
	}

	// dashboard folder not found. create one.
	if err == models.ErrDashboardNotFound {
		dash := &dashboards.SaveDashboardDTO{}
		dash.Dashboard = models.NewDashboardFolder(folderName)
		dash.Dashboard.IsFolder = true
		dash.Overwrite = true
		dash.OrgId = cfg.OrgID
		// set dashboard folderUid if given
		dash.Dashboard.SetUid(cfg.FolderUID)
		dbDash, err := service.SaveFolderForProvisionedDashboards(dash)
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

type dashboardJSONFile struct {
	dashboard    *dashboards.SaveDashboardDTO
	checkSum     string
	lastModified time.Time
}

func (fr *FileReader) readDashboardFromFile(path string, lastModified time.Time, folderID int64) (*dashboardJSONFile, error) {
	reader, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	all, err := ioutil.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	checkSum, err := util.Md5SumString(string(all))
	if err != nil {
		return nil, err
	}

	data, err := simplejson.NewJson(all)
	if err != nil {
		return nil, err
	}

	dash, err := createDashboardJSON(data, lastModified, fr.Cfg, folderID)
	if err != nil {
		return nil, err
	}

	return &dashboardJSONFile{
		dashboard:    dash,
		checkSum:     checkSum,
		lastModified: lastModified,
	}, nil
}

func (fr *FileReader) resolvedPath() string {
	if _, err := os.Stat(fr.Path); os.IsNotExist(err) {
		fr.log.Error("Cannot read directory", "error", err)
	}

	path, err := filepath.Abs(fr.Path)
	if err != nil {
		fr.log.Error("Could not create absolute path", "path", fr.Path, "error", err)
	}

	path, err = filepath.EvalSymlinks(path)
	if err != nil {
		fr.log.Error("Failed to read content of symlinked path", "path", fr.Path, "error", err)
	}

	if path == "" {
		path = fr.Path
		fr.log.Info("falling back to original path due to EvalSymlink/Abs failure")
	}
	return path
}

type provisioningMetadata struct {
	uid      string
	identity dashboardIdentity
}

type dashboardIdentity struct {
	folderID int64
	title    string
}

func (d *dashboardIdentity) Exists() bool {
	return len(d.title) > 0 && d.folderID > 0
}

func newProvisioningSanityChecker(provisioningProvider string) provisioningSanityChecker {
	return provisioningSanityChecker{
		provisioningProvider: provisioningProvider,
		uidUsage:             map[string]uint8{},
		titleUsage:           map[dashboardIdentity]uint8{},
	}
}

type provisioningSanityChecker struct {
	provisioningProvider string
	uidUsage             map[string]uint8
	titleUsage           map[dashboardIdentity]uint8
}

func (checker provisioningSanityChecker) track(pm provisioningMetadata) {
	if len(pm.uid) > 0 {
		checker.uidUsage[pm.uid]++
	}
	if pm.identity.Exists() {
		checker.titleUsage[pm.identity]++
	}
}

func (checker provisioningSanityChecker) logWarnings(log log.Logger) {
	for uid, times := range checker.uidUsage {
		if times > 1 {
			log.Error("the same 'uid' is used more than once", "uid", uid, "provider", checker.provisioningProvider)
		}
	}

	for identity, times := range checker.titleUsage {
		if times > 1 {
			log.Error("the same 'title' is used more than once", "title", identity.title, "provider", checker.provisioningProvider)
		}
	}
}
