package libraryelements

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// LibraryElementService is the service for the Library Element feature.
type LibraryElementService struct {
	Cfg           *setting.Cfg          `inject:""`
	SQLStore      *sqlstore.SQLStore    `inject:""`
	RouteRegister routing.RouteRegister `inject:""`
	log           log.Logger
}

const connectionTableName = "library_element_connection"

func init() {
	registry.RegisterService(&LibraryElementService{})
}

// Init initializes the LibraryElement service
func (l *LibraryElementService) Init() error {
	l.log = log.New("library-elements")

	l.registerAPIEndpoints()

	return nil
}

// IsEnabled returns true if the Panel Library feature is enabled for this instance.
func (l *LibraryElementService) IsEnabled() bool {
	if l.Cfg == nil {
		return false
	}

	return l.Cfg.IsPanelLibraryEnabled()
}

// CreateElement creates a Library Element.
func (l *LibraryElementService) CreateElement(c *models.ReqContext, cmd CreateLibraryElementCommand) (LibraryElementDTO, error) {
	if !l.IsEnabled() {
		return LibraryElementDTO{}, nil
	}

	return l.createLibraryElement(c, cmd)
}

// GetElementsForDashboard gets all connected elements for a specific dashboard.
func (l *LibraryElementService) GetElementsForDashboard(c *models.ReqContext, dashboardID int64) (map[string]LibraryElementDTO, error) {
	if !l.IsEnabled() {
		return map[string]LibraryElementDTO{}, nil
	}

	return l.getElementsForDashboardID(c, dashboardID)
}

// ConnectElementsToDashboard connects elements to a specific dashboard.
func (l *LibraryElementService) ConnectElementsToDashboard(c *models.ReqContext, elementUIDs []string, dashboardID int64) error {
	if !l.IsEnabled() {
		return nil
	}

	return l.connectElementsToDashboardID(c, elementUIDs, dashboardID)
}

// DisconnectElementsFromDashboard disconnects elements from a specific dashboard.
func (l *LibraryElementService) DisconnectElementsFromDashboard(c *models.ReqContext, dashboardID int64) error {
	if !l.IsEnabled() {
		return nil
	}

	return l.disconnectElementsFromDashboardID(c, dashboardID)
}

// DeleteLibraryElementsInFolder deletes all elements for a specific folder.
func (l *LibraryElementService) DeleteLibraryElementsInFolder(c *models.ReqContext, folderUID string) error {
	if !l.IsEnabled() {
		return nil
	}
	return l.deleteLibraryElementsInFolderUID(c, folderUID)
}

// AddMigration defines database migrations.
// If Panel Library is not enabled does nothing.
func (l *LibraryElementService) AddMigration(mg *migrator.Migrator) {
	if !l.IsEnabled() {
		return
	}

	libraryElementsV1 := migrator.Table{
		Name: "library_element",
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

	mg.AddMigration("create library_element table v1", migrator.NewAddTableMigration(libraryElementsV1))
	mg.AddMigration("add index library_element", migrator.NewAddIndexMigration(libraryElementsV1, libraryElementsV1.Indices[0]))

	libraryElementConnectionV1 := migrator.Table{
		Name: connectionTableName,
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "library_element_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "connection_kind", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "connection_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created_by", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"library_element_id", "connection_kind", "connection_id"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create "+connectionTableName+" table v1", migrator.NewAddTableMigration(libraryElementConnectionV1))
	mg.AddMigration("add index "+connectionTableName, migrator.NewAddIndexMigration(libraryElementConnectionV1, libraryElementConnectionV1.Indices[0]))
}
