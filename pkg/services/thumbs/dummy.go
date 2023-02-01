package thumbs

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

// When the feature flag is not enabled we just implement a dummy service
type dummyService struct{}

func (ds *dummyService) GetUsageStats(ctx context.Context) map[string]interface{} {
	return make(map[string]interface{})
}

func (ds *dummyService) GetImage(c *contextmodel.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) UpdateThumbnailState(c *contextmodel.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) SetImage(c *contextmodel.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) Enabled() bool {
	return false
}

func (ds *dummyService) GetDashboardPreviewsSetupSettings(c *contextmodel.ReqContext) dtos.DashboardPreviewsSetupConfig {
	return dtos.DashboardPreviewsSetupConfig{
		SystemRequirements: dtos.DashboardPreviewsSystemRequirements{
			Met:                                false,
			RequiredImageRendererPluginVersion: "",
		},
		ThumbnailsExist: false,
	}
}

func (ds *dummyService) StartCrawler(c *contextmodel.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(http.StatusOK, result)
}

func (ds *dummyService) StopCrawler(c *contextmodel.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(http.StatusOK, result)
}

func (ds *dummyService) CrawlerStatus(c *contextmodel.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(http.StatusOK, result)
}

func (ds *dummyService) Run(ctx context.Context) error {
	return nil
}
