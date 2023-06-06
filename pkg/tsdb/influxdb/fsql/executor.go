package fsql

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
)

func executeQuery(ctx context.Context, logger log.Logger, query queryModel, runner queryRunner,
	maxSeries int) (dr backend.DataResponse) {
	dr = backend.DataResponse{}

	//
	// sql := interpolate(query)

	logger.Debug("Executing FlightSQL query", "flightsql", query)

	return dr
}
