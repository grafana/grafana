package api

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

var frontendLogger = log.New("frontend")

func (hs *HTTPServer) LogFrontendMessage(c *models.ReqContext) Response {
	data, err := c.Req.Body().String()
	if err != nil {
		return Error(500, "Failed to read log message", err)
	}

	frontendLogger.Error(data)

	return Success("ok")
}
