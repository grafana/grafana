package sqlstore

import (
	"errors"
	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetDataSourcesQuery)
	bus.AddHandler("sql", AddDataSource)
}

func GetDataSourcesQuery(query *m.GetDataSourcesQuery) error {
	return errors.New("Hello from query handler")
}

func AddDataSource(cmd *m.AddDataSourceCommand) error {
	return errors.New("Hello from command handler")
}
