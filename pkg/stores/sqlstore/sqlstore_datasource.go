package sqlstore

import (
	"errors"
	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddQueryHandler("sql", GetDataSourcesQuery)
}

func GetDataSourcesQuery(query *m.GetDataSourcesQuery) error {
	return errors.New("Hello from query handler")
}
