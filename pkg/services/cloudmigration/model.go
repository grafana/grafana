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

type MigratedResourceResult struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type MigrationResult struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type MigratedResource struct {
	Type   string                 `json:"type"`
	ID     string                 `json:"id"`
	RefID  string                 `json:"refID"`
	Name   string                 `json:"name"`
	Result MigratedResourceResult `json:"result"`
}

type CloudMigrationRun struct {
	ID                int64              `json:"id" xorm:"pk autoincr 'id'"`
	CloudMigrationUID string             `json:"uid" xorm:"cloud_migration_uid"`
	Resources         []MigratedResource `json:"items"`
	Result            MigrationResult    `json:"result"`
	Created           time.Time          `json:"created"`
	Updated           time.Time          `json:"updated"`
	Finished          time.Time          `json:"finished"`
}

type CloudMigrationRequest struct {
	AuthToken string `json:"authToken"`
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
