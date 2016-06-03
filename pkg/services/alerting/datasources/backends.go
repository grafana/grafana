package graphite

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

// AlertDatasource is bacon
type AlertDatasource interface {
	GetSeries(job *m.AlertJob, datasource m.DataSource) (m.TimeSeriesSlice, error)
}

// GetSeries returns timeseries data from the datasource
func GetSeries(job *m.AlertJob) (m.TimeSeriesSlice, error) {
	query := &m.GetDataSourceByIdQuery{
		Id:    job.Rule.DatasourceId,
		OrgId: job.Rule.OrgId,
	}

	err := bus.Dispatch(query)

	if err != nil {
		return nil, fmt.Errorf("Could not find datasource for %d", job.Rule.DatasourceId)
	}

	if query.Result.Type == m.DS_GRAPHITE {
		return GraphiteClient{}.GetSeries(job, query.Result)
	}

	return nil, fmt.Errorf("Grafana does not support alerts for %s", query.Result.Type)
}
