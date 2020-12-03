package panellib

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// PanelLib is the service the Panel Libary feature.
type PanelLib struct {
	Cfg      *setting.Cfg       `inject:""`
	SQLStore *sqlstore.SQLStore `inject:""`
	log      log.Logger
}

func init() {
	registry.RegisterService(&PanelLib{})
}

// Init initializes the PanelLib Service.
func (pl *PanelLib) Init() error {
	pl.log = log.New("panellib")

	return nil
}

// IsEnabled returns true if the PanelLib service is enabled for this instance.
func (pl *PanelLib) IsEnabled() bool {
	if pl.Cfg == nil {
		return false
	}

	return pl.Cfg.IsPanelLibraryEnabled()
}

// AddMigration defines database migrations.
// If Panel Library is not enabled does nothing.
func (pl *PanelLib) AddMigration(mg *migrator.Migrator) {
	if !pl.IsEnabled() {
		return
	}

	mg.AddMigration("drop old table panellib", migrator.NewDropTableMigration("panellib"))

	panellibV1 := migrator.Table{
		Name: "panellib",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "folder_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created_by", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_BigInt, Nullable: false},
		},
	}

	mg.AddMigration("create panellib table v1", migrator.NewAddTableMigration(panellibV1))
}
