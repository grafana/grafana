package dashboards

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/provisioning/utils"
	"github.com/grafana/grafana/pkg/util"
)

var (
	// ErrFolderNameMissing is returned when folder name is missing.
	ErrFolderNameMissing = errors.New("folder name missing")
	// ErrGetOrCreateFolder is returned when there is a failure to fetch or create a provisioning folder.
	ErrGetOrCreateFolder = errors.New("failed to get or create provisioning folder")
)

// FileReader is responsible for reading dashboards from disk and
// insert/update dashboards to the Grafana database using
// `dashboards.DashboardProvisioningService`.
type FileReader struct {
	Cfg                          *config
	Path                         string
	log                          log.Logger
	dashboardProvisioningService dashboards.DashboardProvisioningService
	dashboardStore               utils.DashboardStore
	FoldersFromFilesStructure    bool
	folderService                folder.Service

	mux                     sync.RWMutex
	usageTracker            *usageTracker
	dbWriteAccessRestricted bool
}

// NewDashboardFileReader returns a new filereader based on `config`
func NewDashboardFileReader(cfg *config, log log.Logger, service dashboards.DashboardProvisioningService,
	dashboardStore utils.DashboardStore, folderService folder.Service) (*FileReader, error) {
	var path string
	path, ok := cfg.Options["path"].(string)
	if !ok {
		path, ok = cfg.Options["folder"].(string)
		if !ok {
			return nil, fmt.Errorf("failed to load dashboards, path param is not a string")
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
		dashboardProvisioningService: service,
		dashboardStore:               dashboardStore,
		folderService:                folderService,
		FoldersFromFilesStructure:    foldersFromFilesStructure,
		usageTracker:                 newUsageTracker(),
	}, nil
}

// pollChanges periodically runs walkDisk based on interval specified in the config.
func (fr *FileReader) pollChanges(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(int64(time.Second) * fr.Cfg.UpdateIntervalSeconds))
	for {
		select {
		case <-ticker.C:
			if err := fr.walkDisk(ctx); err != nil {
				fr.log.Error("failed to search for dashboards", "error", err)
			}
		case <-ctx.Done():
			return
		}
	}
}

// walkDisk traverses the file system for the defined path, reading dashboard definition files,
// and applies any change to the database.
func (fr *FileReader) walkDisk(ctx context.Context) error {
	fr.log.Debug("Start walking disk", "path", fr.Path)
	resolvedPath := fr.resolvedPath()
	if _, err := os.Stat(resolvedPath); err != nil {
		return err
	}

	provisionedDashboardRefs, err := fr.getProvisionedDashboardsByPath(ctx, fr.dashboardProvisioningService, fr.Cfg.Name)
	if err != nil {
		return err
	}

	// Find relevant files
	filesFoundOnDisk := map[string]os.FileInfo{}
	if err := filepath.Walk(resolvedPath, createWalkFn(filesFoundOnDisk)); err != nil {
		return err
	}

	fr.handleMissingDashboardFiles(ctx, provisionedDashboardRefs, filesFoundOnDisk)

	usageTracker := newUsageTracker()
	if fr.FoldersFromFilesStructure {
		err = fr.storeDashboardsInFoldersFromFileStructure(ctx, filesFoundOnDisk, provisionedDashboardRefs, resolvedPath, usageTracker)
	} else {
		err = fr.storeDashboardsInFolder(ctx, filesFoundOnDisk, provisionedDashboardRefs, usageTracker)
	}
	if err != nil {
		return err
	}

	fr.mux.Lock()
	defer fr.mux.Unlock()

	fr.usageTracker = usageTracker
	return nil
}

func (fr *FileReader) changeWritePermissions(restrict bool) {
	fr.mux.Lock()
	defer fr.mux.Unlock()

	fr.dbWriteAccessRestricted = restrict
}

func (fr *FileReader) isDatabaseAccessRestricted() bool {
	fr.mux.RLock()
	defer fr.mux.RUnlock()

	return fr.dbWriteAccessRestricted
}

// storeDashboardsInFolder saves dashboards from the filesystem on disk to the folder from config
func (fr *FileReader) storeDashboardsInFolder(ctx context.Context, filesFoundOnDisk map[string]os.FileInfo,
	dashboardRefs map[string]*dashboards.DashboardProvisioning, usageTracker *usageTracker) error {
	ctx, _ = identity.WithServiceIdentity(ctx, fr.Cfg.OrgID)

	folderID, folderUID, err := fr.getOrCreateFolder(ctx, fr.Cfg, fr.dashboardProvisioningService, fr.Cfg.Folder)
	if err != nil && !errors.Is(err, ErrFolderNameMissing) {
		return fmt.Errorf("%w with name %q: %w", ErrGetOrCreateFolder, fr.Cfg.Folder, err)
	}

	// save dashboards based on json files
	for path, fileInfo := range filesFoundOnDisk {
		provisioningMetadata, err := fr.saveDashboard(ctx, path, folderID, folderUID, fileInfo, dashboardRefs)
		if err != nil {
			fr.log.Error("failed to save dashboard", "file", path, "error", err)
			continue
		}

		usageTracker.track(provisioningMetadata)
	}
	return nil
}

// storeDashboardsInFoldersFromFilesystemStructure saves dashboards from the filesystem on disk to the same folder
// in Grafana as they are in on the filesystem.
func (fr *FileReader) storeDashboardsInFoldersFromFileStructure(ctx context.Context, filesFoundOnDisk map[string]os.FileInfo,
	dashboardRefs map[string]*dashboards.DashboardProvisioning, resolvedPath string, usageTracker *usageTracker) error {
	for path, fileInfo := range filesFoundOnDisk {
		folderName := ""

		dashboardsFolder := filepath.Dir(path)
		if dashboardsFolder != resolvedPath {
			folderName = filepath.Base(dashboardsFolder)
		}

		ctx, _ = identity.WithServiceIdentity(ctx, fr.Cfg.OrgID)
		folderID, folderUID, err := fr.getOrCreateFolder(ctx, fr.Cfg, fr.dashboardProvisioningService, folderName)
		if err != nil && !errors.Is(err, ErrFolderNameMissing) {
			return fmt.Errorf("%w with name %q from file system structure: %w", ErrGetOrCreateFolder, folderName, err)
		}

		provisioningMetadata, err := fr.saveDashboard(ctx, path, folderID, folderUID, fileInfo, dashboardRefs)
		usageTracker.track(provisioningMetadata)
		if err != nil {
			fr.log.Error("failed to save dashboard", "file", path, "error", err)
		}
	}
	return nil
}

// handleMissingDashboardFiles will unprovision or delete dashboards which are missing on disk.
func (fr *FileReader) handleMissingDashboardFiles(ctx context.Context, provisionedDashboardRefs map[string]*dashboards.DashboardProvisioning,
	filesFoundOnDisk map[string]os.FileInfo) {
	// find dashboards to delete since json file is missing
	var dashboardsToDelete []int64
	for path, provisioningData := range provisionedDashboardRefs {
		_, existsOnDisk := filesFoundOnDisk[path]
		if !existsOnDisk {
			dashboardsToDelete = append(dashboardsToDelete, provisioningData.DashboardID)
		}
	}

	if fr.Cfg.DisableDeletion {
		// If deletion is disabled for the provisioner we just remove provisioning metadata about the dashboard
		// so afterwards the dashboard is considered unprovisioned.
		for _, dashboardID := range dashboardsToDelete {
			fr.log.Debug("unprovisioning provisioned dashboard. missing on disk", "id", dashboardID)
			err := fr.dashboardProvisioningService.UnprovisionDashboard(ctx, dashboardID)
			if err != nil {
				fr.log.Error("failed to unprovision dashboard", "dashboard_id", dashboardID, "error", err)
			}
		}
	} else {
		// delete dashboards missing JSON file
		for _, dashboardID := range dashboardsToDelete {
			fr.log.Debug("deleting provisioned dashboard, missing on disk", "id", dashboardID)
			err := fr.dashboardProvisioningService.DeleteProvisionedDashboard(ctx, dashboardID, fr.Cfg.OrgID)
			if err != nil {
				fr.log.Error("failed to delete dashboard", "id", dashboardID, "error", err)
			}
		}
	}
}

// saveDashboard saves or updates the dashboard provisioning file at path.
func (fr *FileReader) saveDashboard(ctx context.Context, path string, folderID int64, folderUID string, fileInfo os.FileInfo,
	provisionedDashboardRefs map[string]*dashboards.DashboardProvisioning) (provisioningMetadata, error) {
	provisioningMetadata := provisioningMetadata{}
	resolvedFileInfo, err := resolveSymlink(fileInfo, path)
	if err != nil {
		return provisioningMetadata, err
	}

	provisionedData, alreadyProvisioned := provisionedDashboardRefs[path]

	jsonFile, err := fr.readDashboardFromFile(path, resolvedFileInfo.ModTime(), folderID, folderUID)
	if err != nil {
		fr.log.Error("failed to load dashboard from ", "file", path, "error", err)
		return provisioningMetadata, nil
	}

	upToDate := alreadyProvisioned
	if provisionedData != nil {
		upToDate = jsonFile.checkSum == provisionedData.CheckSum
	}

	// keeps track of which UIDs and titles we have already provisioned
	dash := jsonFile.dashboard
	provisioningMetadata.uid = dash.Dashboard.UID
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Provisioning).Inc()
	// nolint:staticcheck
	provisioningMetadata.identity = dashboardIdentity{title: dash.Dashboard.Title, folderID: dash.Dashboard.FolderID}

	// fix empty folder_uid from already provisioned dashboards
	if upToDate && folderUID != "" {
		// search for root dashboard with the specified uid or title
		d, err := fr.dashboardStore.GetDashboard(
			ctx,
			&dashboards.GetDashboardQuery{
				OrgID:     jsonFile.dashboard.OrgID,
				UID:       jsonFile.dashboard.Dashboard.UID,
				FolderUID: util.Pointer(""),

				// provisioning depends on unique names
				//nolint:staticcheck
				Title: &jsonFile.dashboard.Dashboard.Title,
			},
		)
		if err != nil {
			// if no problematic entry is found it's safe to ignore
			if !errors.Is(err, dashboards.ErrDashboardNotFound) {
				return provisioningMetadata, err
			}
		} else {
			// inconsistency is detected so force updating the dashboard
			if d.FolderUID != folderUID {
				upToDate = false
			}
		}
	}

	if upToDate {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Provisioning).Inc()
		// nolint:staticcheck
		fr.log.Debug("provisioned dashboard is up to date", "provisioner", fr.Cfg.Name, "file", path, "folderId", dash.Dashboard.FolderID, "folderUid", dash.Dashboard.FolderUID)
		return provisioningMetadata, nil
	}

	if dash.Dashboard.ID != 0 {
		dash.Dashboard.Data.Set("id", nil)
		dash.Dashboard.ID = 0
	}

	if alreadyProvisioned {
		dash.Dashboard.SetID(provisionedData.DashboardID)
	}

	if !fr.isDatabaseAccessRestricted() {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Provisioning).Inc()
		// nolint:staticcheck
		fr.log.Debug("saving new dashboard", "provisioner", fr.Cfg.Name, "file", path, "folderId", dash.Dashboard.FolderID, "folderUid", dash.Dashboard.FolderUID)
		dp := &dashboards.DashboardProvisioning{
			ExternalID: path,
			Name:       fr.Cfg.Name,
			Updated:    resolvedFileInfo.ModTime().Unix(),
			CheckSum:   jsonFile.checkSum,
		}
		_, err := fr.dashboardProvisioningService.SaveProvisionedDashboard(ctx, dash, dp)
		if err != nil {
			return provisioningMetadata, err
		}
	} else {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Provisioning).Inc()
		// nolint:staticcheck
		fr.log.Warn("Not saving new dashboard due to restricted database access", "provisioner", fr.Cfg.Name,
			"file", path, "folderId", dash.Dashboard.FolderID)
	}

	return provisioningMetadata, nil
}

func (fr *FileReader) getProvisionedDashboardsByPath(ctx context.Context, service dashboards.DashboardProvisioningService, name string) (
	map[string]*dashboards.DashboardProvisioning, error) {
	arr, err := service.GetProvisionedDashboardData(ctx, name)
	if err != nil {
		return nil, err
	}

	byPath := map[string]*dashboards.DashboardProvisioning{}
	for _, pd := range arr {
		// as a part of the migration of dashboards to unified storage, the dashboard provisiong data will be stored as
		// an annotation on the dashboard. in modes 0-2, that will only return the relative path. however, we will be comparing
		// that to the data stored in the dashboard_provisioning table, so we need to change it into the resolved path
		if !strings.HasPrefix(pd.ExternalID, fr.resolvedPath()) {
			pd.ExternalID = fr.resolvedPath() + "/" + pd.ExternalID
		}

		byPath[pd.ExternalID] = pd
	}

	return byPath, nil
}

func (fr *FileReader) getOrCreateFolder(ctx context.Context, cfg *config, service dashboards.DashboardProvisioningService, folderName string) (int64, string, error) {
	if folderName == "" {
		return 0, "", ErrFolderNameMissing
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return 0, "", err
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Provisioning).Inc()
	cmd := &folder.GetFolderQuery{
		OrgID:        cfg.OrgID,
		SignedInUser: user,
	}

	if cfg.FolderUID != "" {
		cmd.UID = &cfg.FolderUID
	} else {
		// provisioning depends on unique names
		//nolint:staticcheck
		cmd.Title = &folderName
	}

	result, err := fr.folderService.Get(ctx, cmd)
	if err != nil && !errors.Is(err, dashboards.ErrFolderNotFound) {
		return 0, "", err
	}

	// do not allow the creation of folder with uid "general"
	if result != nil && result.UID == accesscontrol.GeneralFolderUID {
		return 0, "", dashboards.ErrFolderInvalidUID
	}

	// dashboard folder not found. create one.
	if errors.Is(err, dashboards.ErrFolderNotFound) {
		createCmd := &folder.CreateFolderCommand{
			OrgID:        cfg.OrgID,
			UID:          cfg.FolderUID,
			Title:        folderName,
			SignedInUser: user,
		}

		f, err := service.SaveFolderForProvisionedDashboards(ctx, createCmd)
		if err != nil {
			return 0, "", err
		}
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Provisioning).Inc()
		// nolint:staticcheck
		return f.ID, f.UID, nil
	}

	//nolint:staticcheck
	return result.ID, result.UID, nil
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

func (fr *FileReader) readDashboardFromFile(path string, lastModified time.Time, folderID int64, folderUID string) (*dashboardJSONFile, error) {
	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `path` comes from the provisioning configuration file.
	reader, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := reader.Close(); err != nil {
			fr.log.Warn("Failed to close file", "path", path, "err", err)
		}
	}()

	all, err := io.ReadAll(reader)
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

	dash, err := createDashboardJSON(data, lastModified, fr.Cfg, folderID, folderUID)
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

func (fr *FileReader) getUsageTracker() *usageTracker {
	fr.mux.RLock()
	defer fr.mux.RUnlock()

	return fr.usageTracker
}

type provisioningMetadata struct {
	uid      string
	identity dashboardIdentity
}

type dashboardIdentity struct {
	// Deprecated: use folderUID instead
	folderID  int64
	folderUID string
	title     string
}

func (d *dashboardIdentity) Exists() bool {
	return len(d.title) > 0
}

func newUsageTracker() *usageTracker {
	return &usageTracker{
		uidUsage:   map[string]uint8{},
		titleUsage: map[dashboardIdentity]uint8{},
	}
}

type usageTracker struct {
	uidUsage   map[string]uint8
	titleUsage map[dashboardIdentity]uint8
}

func (t *usageTracker) track(pm provisioningMetadata) {
	if len(pm.uid) > 0 {
		t.uidUsage[pm.uid]++
	}
	if pm.identity.Exists() {
		t.titleUsage[pm.identity]++
	}
}
