package api

import (
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type DashboardHealthStatus struct {
	UID            string    `json:"uid"`
	Title          string    `json:"title"`
	Status         string    `json:"status"`
	PanelCount     int       `json:"panelCount"`
	ErrorCount     int       `json:"errorCount"`
	LastAccessed   time.Time `json:"lastAccessed"`
	AvgLoadTime    float64   `json:"avgLoadTimeMs"`
	HealthScore    int       `json:"healthScore"`
}

func (hs *HTTPServer) GetDashboardHealth(c *contextmodel.ReqContext) response.Response {
	uid := c.Params(":uid")
	if uid == "" {
		return response.Error(http.StatusBadRequest, "Dashboard UID is required", nil)
	}

	// Mock health data - in real implementation, this would query metrics
	health := DashboardHealthStatus{
		UID:          uid,
		Title:        "Sample Dashboard",
		Status:       "healthy",
		PanelCount:   12,
		ErrorCount:   0,
		LastAccessed: time.Now().Add(-2 * time.Hour),
		AvgLoadTime:  1250.5,
		HealthScore:  95,
	}

	return response.JSON(http.StatusOK, health)
}