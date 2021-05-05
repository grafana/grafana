package entities

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// EntityService is the service for the Panel Library feature.
type EntityService struct {
	Cfg           *setting.Cfg          `inject:""`
	SQLStore      *sqlstore.SQLStore    `inject:""`
	RouteRegister routing.RouteRegister `inject:""`
	log           log.Logger
}

func init() {
	registry.RegisterService(&EntityService{})
}

// Init initializes the Entity service
func (e *EntityService) Init() error {
	e.log = log.New("librarypanels")

	e.registerAPIEndpoints()

	return nil
}

// IsEnabled returns true if the Panel Library feature is enabled for this instance.
func (e *EntityService) IsEnabled() bool {
	if e.Cfg == nil {
		return false
	}

	return e.Cfg.IsPanelLibraryEnabled()
}

// AddMigration defines database migrations.
// If Panel Library is not enabled does nothing.
func (e *EntityService) AddMigration(mg *migrator.Migrator) {
	if !e.IsEnabled() {
		return
	}

	entityV1 := migrator.Table{
		Name: "entity",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "folder_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "kind", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "type", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "description", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "model", Type: migrator.DB_Text, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created_by", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "version", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id", "folder_id", "name", "kind"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create entity table v1", migrator.NewAddTableMigration(entityV1))
	mg.AddMigration("add index entity org_id & folder_id & name & kind", migrator.NewAddIndexMigration(entityV1, entityV1.Indices[0]))

	entityDashboardV1 := migrator.Table{
		Name: "entity_dashboard",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "entity_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "dashboard_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created_by", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"entity_id", "dashboard_id"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create entity_dashboard table v1", migrator.NewAddTableMigration(entityDashboardV1))
	mg.AddMigration("add index entity_dashboard entity_id & dashboard_id", migrator.NewAddIndexMigration(entityDashboardV1, entityDashboardV1.Indices[0]))
}
