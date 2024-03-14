package cloudmigration

import (
	"time"

	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	ErrInternalNotImplementedError = errutil.Internal("cloudmigrations.notImplemented", errutil.WithPublicMessage("Internal server error"))
	ErrFeatureDisabledError        = errutil.Internal("cloudmigrations.disabled", errutil.WithPublicMessage("Cloud migrations are disabled on this instance"))
)

type CloudMigration struct {
	ID        int64     `json:"id" xorm:"pk autoincr 'id'"`
	AuthToken string    `json:"authToken"`
	Stack     string    `json:"stack"`
	Created   time.Time `json:"created"`
	Updated   time.Time `json:"updated"`
}

type CloudMigrationRun struct {
	ID                int64     `json:"id" xorm:"pk autoincr 'id'"`
	CloudMigrationUID string    `json:"uid" xorm:"cloud_migration_uid"`
	Result            string    `json:"result"`
	Created           time.Time `json:"created"`
	Updated           time.Time `json:"updated"`
	Finished          time.Time `json:"finished"`
}

type CloudMigrationRequest struct {
	Stack string `json:"stack"`
}

type CloudMigrationResponse struct {
	ID      int64     `json:"id"`
	Stack   string    `json:"stack"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

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
