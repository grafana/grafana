package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandlerCtx("sql", GetDBHealthQuery)
}

func GetDBHealthQuery(ctx context.Context, query *m.GetDBHealthQuery) error {
	return x.Ping()
}
