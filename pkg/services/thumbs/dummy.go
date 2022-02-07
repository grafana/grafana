package thumbs

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

// When the feature flag is not enabled we just implement a dummy service
type dummyService struct{}

func (ds *dummyService) GetImage(c *models.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) SetImage(c *models.ReqContext) {
	c.JSON(400, map[string]string{"error": "invalid size"})
}

func (ds *dummyService) Enabled() bool {
	return false
}

func (ds *dummyService) StartCrawler(c *models.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(200, result)
}

func (ds *dummyService) StopCrawler(c *models.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(200, result)
}

func (ds *dummyService) CrawlerStatus(c *models.ReqContext) response.Response {
	result := make(map[string]string)
	result["error"] = "Not enabled"
	return response.JSON(200, result)
}
