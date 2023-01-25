package thumbs

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/contexthandler/model"
)

// When the feature flag is not enabled we just implement a dummy service
type dummyService struct{}

func (ds *dummyService) GetUsageStats(ctx context.Context) map[string]interface{} {
	return make(map[string]interface{})
}

func (ds *dummyService) GetImage(c *model.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) UpdateThumbnailState(c *model.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) SetImage(c *model.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) Enabled() bool {
	return false
}

func (ds *dummyService) GetDashboardPreviewsSetupSettings(c *model.ReqContext) dashboardPreviewsSetupConfig {
	return dashboardPreviewsSetupConfig{
		SystemRequirements: dashboardPreviewsSystemRequirements{
			Met:                                false,
			RequiredImageRendererPluginVersion: "",
		},
		ThumbnailsExist: false,
	}
}

func (ds *dummyService) StartCrawler(c *model.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(http.StatusOK, result)
}

func (ds *dummyService) StopCrawler(c *model.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(http.StatusOK, result)
}

func (ds *dummyService) CrawlerStatus(c *model.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(http.StatusOK, result)
}

func (ds *dummyService) Run(ctx context.Context) error {
	return nil
}
