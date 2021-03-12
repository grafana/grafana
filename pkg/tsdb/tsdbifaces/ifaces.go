package tsdbifaces

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

// RequestHandler is a data request handler interface.
type RequestHandler interface {
	HandleRequest(context.Context, *models.DataSource, plugins.DataQuery) (plugins.DataResponse, error)
}
