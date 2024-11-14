package service

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/publicdashboards/models"
)

/**
A place to record relevant logs and metrics within the service layer of public dashboards
*/

func LogQuerySuccess(datasources []string, log log.Logger) {
	log.Info("Successfully queried datasources for public dashboard", "datasources", datasources)
	label := getLabelName(datasources)
	metrics.MPublicDashboardDatasourceQuerySuccess.WithLabelValues(label, models.QuerySuccess).Inc()
}

func LogQueryFailure(datasources []string, log log.Logger, err error) {
	log.Error("Error querying datasources for public dashboard", "error", err.Error(), "datasources", datasources)
	label := getLabelName(datasources)
	metrics.MPublicDashboardDatasourceQuerySuccess.WithLabelValues(label, models.QueryFailure).Inc()
}

func getLabelName(datasources []string) string {
	size := len(datasources)

	switch size {
	case 0:
		return "none"
	case 1:
		return datasources[0]
	default:
		return "mixed"
	}
}
