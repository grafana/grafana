package export

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type ExportService interface {
	// List folder contents
	HandleGetStatus(c *models.ReqContext) response.Response

	// Read raw file contents out of the store
	HandleRequestExport(c *models.ReqContext) response.Response
}

type StandardExport struct {
	logger log.Logger
	sql    *sqlstore.SQLStore
	mutex  sync.Mutex

	// updated with mutex
	status ExportStatus
	cfg    ExportConfig
}

func ProvideService(sql *sqlstore.SQLStore, features featuremgmt.FeatureToggles) ExportService {
	if !features.IsEnabled(featuremgmt.FlagExport) {
		return &StubExport{}
	}

	return &StandardExport{
		sql:    sql,
		logger: log.New("export"),
	}
}

func (ex *StandardExport) HandleGetStatus(c *models.ReqContext) response.Response {
	ex.mutex.Lock()
	defer ex.mutex.Unlock()

	if ex.status.Started > 0 {
		return response.JSON(http.StatusOK, ex.status)
	}

	// The system is not currently running
	return response.JSON(http.StatusOK, ExportStatus{
		Running: false,
		Changed: time.Now().UnixMilli(),
	})
}

func (ex *StandardExport) HandleRequestExport(c *models.ReqContext) response.Response {
	var cfg ExportConfig
	err := json.NewDecoder(c.Req.Body).Decode(&cfg)
	if err != nil {
		return response.Error(http.StatusBadRequest, "unable to read config", err)
	}

	if cfg.Format != "git" {
		return response.Error(http.StatusBadRequest, "only git format supported for now", err)
	}

	ex.mutex.Lock()
	defer ex.mutex.Unlock()

	if ex.status.Running {
		return response.Error(http.StatusLocked, "export already running", nil)
	}

	ex.cfg = cfg
	ex.status = ExportStatus{
		Running: true,
		Target:  "git export",
		Started: time.Now().UnixMilli(),
	}
	go ex.doExport()

	return response.JSON(http.StatusOK, ex.status)
}

// This will replace the running instance
func (ex *StandardExport) doExport() {
	defer func() {
		s := ex.status
		if err := recover(); err != nil {
			ex.logger.Error("export panic", "error", err)
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
		ex.status = s
	}()

	ex.status.Running = true
	ex.status.Count = int64(math.Round(10 + rand.Float64()*20))
	ex.status.Current = 0

	ticker := time.NewTicker(1 * time.Second)
	for t := range ticker.C {
		ex.status.Changed = t.UnixMilli()
		ex.status.Current++
		ex.status.Last = fmt.Sprintf("ITEM: %d", ex.status.Current)

		// Stop after 20 seconds
		if ex.status.Current >= ex.status.Count {
			break
		}
	}
}
