package librarypanels

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// LibraryPanelService is the service for the Panel Library feature.
type LibraryPanelService struct {
	Cfg           *setting.Cfg          `inject:""`
	SQLStore      *sqlstore.SQLStore    `inject:""`
	RouteRegister routing.RouteRegister `inject:""`
	log           log.Logger
}

func init() {
	registry.RegisterService(&LibraryPanelService{})
}

// Init initializes the LibraryPanel service
func (lps *LibraryPanelService) Init() error {
	lps.log = log.New("librarypanels")

	lps.registerAPIEndpoints()

	return nil
}

// IsEnabled returns true if the Panel Library feature is enabled for this instance.
func (lps *LibraryPanelService) IsEnabled() bool {
	if lps.Cfg == nil {
		return false
	}

	return lps.Cfg.IsPanelLibraryEnabled()
}

// AddMigration defines database migrations.
// If Panel Library is not enabled does nothing.
func (lps *LibraryPanelService) AddMigration(mg *migrator.Migrator) {
	if !lps.IsEnabled() {
		return
	}

	libraryPanelV1 := migrator.Table{
		Name: "library_panel",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "folder_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "model", Type: migrator.DB_Text, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created_by", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_BigInt, Nullable: false},
		},
	}

	mg.AddMigration("create library_panel table v1", migrator.NewAddTableMigration(libraryPanelV1))
}
