package tsdbifaces

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	pluginmodels "github.com/grafana/grafana/pkg/plugins/models"
)

// RequestHandler is a TSDB request handler interface.
type RequestHandler interface {
	HandleRequest(context.Context, *models.DataSource, pluginmodels.TSDBQuery) (pluginmodels.TSDBResponse, error)
}
