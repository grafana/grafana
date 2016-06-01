package graphite

import (
	"fmt"
	m "github.com/grafana/grafana/pkg/models"
)

func GetSeries(job *m.AlertJob) (m.TimeSeriesSlice, error) {
	if job.Datasource.Type == m.DS_GRAPHITE {
		return GraphiteClient{}.GetSeries(job)
	}

	return nil, fmt.Errorf("Grafana does not support alerts for %s", job.Datasource.Type)
}
