package export

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type ExportService interface {
	// List folder contents
	HandleGetStatus(c *models.ReqContext) response.Response

	// Read raw file contents out of the store
	HandleRequestExport(c *models.ReqContext) response.Response

	// Cancel any running export
	HandleRequestStop(c *models.ReqContext) response.Response
}

type StandardExport struct {
	logger  log.Logger
	glive   *live.GrafanaLive
	mutex   sync.Mutex
	dataDir string

	// Services
	sql                       *sqlstore.SQLStore
	dashboardsnapshotsService dashboardsnapshots.Service

	// updated with mutex
	exportJob Job
}

func ProvideService(sql *sqlstore.SQLStore, features featuremgmt.FeatureToggles, gl *live.GrafanaLive, cfg *setting.Cfg, dashboardsnapshotsService dashboardsnapshots.Service) ExportService {
	if !features.IsEnabled(featuremgmt.FlagExport) {
		return &StubExport{}
	}

	return &StandardExport{
		sql:                       sql,
		glive:                     gl,
		logger:                    log.New("export_service"),
		dashboardsnapshotsService: dashboardsnapshotsService,
		exportJob:                 &stoppedJob{},
		dataDir:                   cfg.DataPath,
	}
}

func (ex *StandardExport) HandleGetStatus(c *models.ReqContext) response.Response {
	ex.mutex.Lock()
	defer ex.mutex.Unlock()

	return response.JSON(http.StatusOK, ex.exportJob.getStatus())
}

func (ex *StandardExport) HandleRequestStop(c *models.ReqContext) response.Response {
	ex.mutex.Lock()
	defer ex.mutex.Unlock()

	ex.exportJob.requestStop()

	return response.JSON(http.StatusOK, ex.exportJob.getStatus())
}

func (ex *StandardExport) HandleRequestExport(c *models.ReqContext) response.Response {
	var cfg ExportConfig
	err := json.NewDecoder(c.Req.Body).Decode(&cfg)
	if err != nil {
		return response.Error(http.StatusBadRequest, "unable to read config", err)
	}

	ex.mutex.Lock()
	defer ex.mutex.Unlock()

	status := ex.exportJob.getStatus()
	if status.Running {
		ex.logger.Error("export already running")
		return response.Error(http.StatusLocked, "export already running", nil)
	}

	var job Job
	broadcast := func(s ExportStatus) {
		ex.broadcastStatus(c.OrgId, s)
	}
	switch cfg.Format {
	case "dummy":
		job, err = startDummyExportJob(cfg, broadcast)
	case "git":
		dir := filepath.Join(ex.dataDir, "export_git", fmt.Sprintf("git_%d", time.Now().Unix()))
		if err := os.MkdirAll(dir, os.ModePerm); err != nil {
			return response.Error(http.StatusBadRequest, "Error creating export folder", nil)
		}
		job, err = startGitExportJob(cfg, ex.sql, ex.dashboardsnapshotsService, dir, c.OrgId, broadcast)
	default:
		return response.Error(http.StatusBadRequest, "Unsupported job format", nil)
	}

	if err != nil {
		ex.logger.Error("failed to start export job", "err", err)
		return response.Error(http.StatusBadRequest, "failed to start export job", err)
	}

	ex.exportJob = job
	return response.JSON(http.StatusOK, ex.exportJob.getStatus())
}

func (ex *StandardExport) broadcastStatus(orgID int64, s ExportStatus) {
	msg, err := json.Marshal(s)
	if err != nil {
		ex.logger.Warn("Error making message", "err", err)
		return
	}
	err = ex.glive.Publish(orgID, "grafana/broadcast/export", msg)
	if err != nil {
		ex.logger.Warn("Error Publish message", "err", err)
		return
	}
}
