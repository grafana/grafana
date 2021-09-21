package libraryelements

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore, routeRegister routing.RouteRegister) *LibraryElementService {
	l := &LibraryElementService{
		Cfg:           cfg,
		SQLStore:      sqlStore,
		RouteRegister: routeRegister,
		log:           log.New("library-elements"),
	}
	l.registerAPIEndpoints()
	return l
}

// Service is a service for operating on library elements.
type Service interface {
	CreateElement(c *models.ReqContext, cmd CreateLibraryElementCommand) (LibraryElementDTO, error)
	GetElement(c *models.ReqContext, UID string) (LibraryElementDTO, error)
	GetElementsForDashboard(c *models.ReqContext, dashboardID int64) (map[string]LibraryElementDTO, error)
	ConnectElementsToDashboard(c *models.ReqContext, elementUIDs []string, dashboardID int64) error
	DisconnectElementsFromDashboard(c *models.ReqContext, dashboardID int64) error
	DeleteLibraryElementsInFolder(c *models.ReqContext, folderUID string) error
}

// LibraryElementService is the service for the Library Element feature.
type LibraryElementService struct {
	Cfg           *setting.Cfg
	SQLStore      *sqlstore.SQLStore
	RouteRegister routing.RouteRegister
	log           log.Logger
}

// CreateElement creates a Library Element.
func (l *LibraryElementService) CreateElement(c *models.ReqContext, cmd CreateLibraryElementCommand) (LibraryElementDTO, error) {
	return l.createLibraryElement(c, cmd)
}

// GetElement gets an element from a UID.
func (l *LibraryElementService) GetElement(c *models.ReqContext, UID string) (LibraryElementDTO, error) {
	return l.getLibraryElementByUid(c, UID)
}

// GetElementsForDashboard gets all connected elements for a specific dashboard.
func (l *LibraryElementService) GetElementsForDashboard(c *models.ReqContext, dashboardID int64) (map[string]LibraryElementDTO, error) {
	return l.getElementsForDashboardID(c, dashboardID)
}

// ConnectElementsToDashboard connects elements to a specific dashboard.
func (l *LibraryElementService) ConnectElementsToDashboard(c *models.ReqContext, elementUIDs []string, dashboardID int64) error {
	return l.connectElementsToDashboardID(c, elementUIDs, dashboardID)
}

// DisconnectElementsFromDashboard disconnects elements from a specific dashboard.
func (l *LibraryElementService) DisconnectElementsFromDashboard(c *models.ReqContext, dashboardID int64) error {
	return l.disconnectElementsFromDashboardID(c, dashboardID)
}

// DeleteLibraryElementsInFolder deletes all elements for a specific folder.
func (l *LibraryElementService) DeleteLibraryElementsInFolder(c *models.ReqContext, folderUID string) error {
	return l.deleteLibraryElementsInFolderUID(c, folderUID)
}
