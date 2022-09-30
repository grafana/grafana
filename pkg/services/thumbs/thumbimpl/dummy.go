package thumbimpl

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/thumbs"
)

// When the feature flag is not enabled we just implement a dummy service
type dummyService struct{}

func (ds *dummyService) GetUsageStats(ctx context.Context) map[string]interface{} {
	return make(map[string]interface{})
}

func (ds *dummyService) GetImage(c *models.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) UpdateThumbnailState(c *models.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) SetImage(c *models.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) Enabled() bool {
	return false
}

func (ds *dummyService) GetDashboardPreviewsSetupSettings(c *models.ReqContext) thumbs.DashboardPreviewsSetupConfig {
	return thumbs.DashboardPreviewsSetupConfig{
		SystemRequirements: thumbs.DashboardPreviewsSystemRequirements{
			Met:                                false,
			RequiredImageRendererPluginVersion: "",
		},
		ThumbnailsExist: false,
	}
}

func (ds *dummyService) StartCrawler(c *models.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(http.StatusOK, result)
}

func (ds *dummyService) StopCrawler(c *models.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(http.StatusOK, result)
}

func (ds *dummyService) CrawlerStatus(c *models.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(http.StatusOK, result)
}

func (ds *dummyService) Run(ctx context.Context) error {
	return nil
}
