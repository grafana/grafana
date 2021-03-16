package plugins

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

// DataRequestHandler is a data request handler interface.
type DataRequestHandler interface {
	HandleRequest(context.Context, *models.DataSource, DataQuery) (DataResponse, error)
}
