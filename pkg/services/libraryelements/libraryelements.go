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

// LibraryElementService is a service for operating on dashboards.
type LibraryElementService interface {
	CreateElement(c *models.ReqContext, cmd CreateLibraryElementCommand) (LibraryElementDTO, error)
	GetElementsForDashboard(c *models.ReqContext, dashboardID int64) (map[string]LibraryElementDTO, error)
	ConnectElementsToDashboard(c *models.ReqContext, elementUIDs []string, dashboardID int64) error
	DisconnectElementsFromDashboard(c *models.ReqContext, dashboardID int64) error
	DeleteLibraryElementsInFolder(c *models.ReqContext, folderUID string) error
}

// NewService is a factory for creating a new library panel service.
var NewService = func(store *sqlstore.SQLStore) LibraryElementService {
	return &libraryElementServiceImpl{
		SQLStore: store,
		log:      log.New("library-elements"),
	}
}

// libraryElementServiceImpl is the service for the Library Element feature.
type libraryElementServiceImpl struct {
	Cfg           *setting.Cfg          `inject:""`
	SQLStore      *sqlstore.SQLStore    `inject:""`
	RouteRegister routing.RouteRegister `inject:""`
	log           log.Logger
}

const connectionTableName = "library_element_connection"

func init() {
	registry.RegisterService(&libraryElementServiceImpl{})
}

// Init initializes the LibraryElement service
func (l *libraryElementServiceImpl) Init() error {
	l.log = log.New("library-elements")

	l.registerAPIEndpoints()

	return nil
}

// CreateElement creates a Library Element.
func (l *libraryElementServiceImpl) CreateElement(c *models.ReqContext, cmd CreateLibraryElementCommand) (LibraryElementDTO, error) {
	return l.createLibraryElement(c, cmd)
}

// GetElementsForDashboard gets all connected elements for a specific dashboard.
func (l *libraryElementServiceImpl) GetElementsForDashboard(c *models.ReqContext, dashboardID int64) (map[string]LibraryElementDTO, error) {
	return l.getElementsForDashboardID(c, dashboardID)
}

// ConnectElementsToDashboard connects elements to a specific dashboard.
func (l *libraryElementServiceImpl) ConnectElementsToDashboard(c *models.ReqContext, elementUIDs []string, dashboardID int64) error {
	return l.connectElementsToDashboardID(c, elementUIDs, dashboardID)
}

// DisconnectElementsFromDashboard disconnects elements from a specific dashboard.
func (l *libraryElementServiceImpl) DisconnectElementsFromDashboard(c *models.ReqContext, dashboardID int64) error {
	return l.disconnectElementsFromDashboardID(c, dashboardID)
}

// DeleteLibraryElementsInFolder deletes all elements for a specific folder.
func (l *libraryElementServiceImpl) DeleteLibraryElementsInFolder(c *models.ReqContext, folderUID string) error {
	return l.deleteLibraryElementsInFolderUID(c, folderUID)
}

// AddMigration defines database migrations.
// If Panel Library is not enabled does nothing.
func (l *libraryElementServiceImpl) AddMigration(mg *migrator.Migrator) {
	libraryElementsV1 := migrator.Table{
		Name: "library_element",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "folder_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 200, Nullable: false},
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
			{Cols: []string{"org_id", "folder_id", "folder_id", "kind"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create library_element table v1", migrator.NewAddTableMigration(libraryElementsV1))
	mg.AddMigration("add index library_element org_id & folder_id & folder_id & kind", migrator.NewAddIndexMigration(libraryElementsV1, libraryElementsV1.Indices[0]))

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
	mg.AddMigration("add index "+connectionTableName+" library_element_id & connection_kind & connection_id", migrator.NewAddIndexMigration(libraryElementConnectionV1, libraryElementConnectionV1.Indices[0]))
}
