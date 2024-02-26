package cloudmigration

import (
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	ErrInternalNotImplementedError = errutil.Internal("cloudmigrations.notImplemented", errutil.WithPublicMessage("Internal server error"))
	ErrFeatureDisabledError        = errutil.Internal("cloudmigrations.disabled", errutil.WithPublicMessage("Cloud migrations are disabled on this instance"))
)

type MigrateDatasourcesRequest struct {
	MigrateToPDC       bool
	MigrateCredentials bool
}

type MigrateDatasourcesResponse struct {
	DatasourcesMigrated int
}

type MigrateDatasourcesRequestDTO struct {
	MigrateToPDC       bool `json:"migrateToPDC"`
	MigrateCredentials bool `json:"migrateCredentials"`
}

type MigrateDatasourcesResponseDTO struct {
	DatasourcesMigrated int `json:"datasourcesMigrated"`
}

const (
	namespace = "grafana"
	subsystem = "cloudmigrations"
)

var PromMetrics = []prometheus.Collector{
	prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "datasources_migrated",
		Help:      "Total amount of data sources migrated",
	}, []string{"pdc_converted"}),
}
