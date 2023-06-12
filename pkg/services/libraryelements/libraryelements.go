package libraryelements

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, routeRegister routing.RouteRegister, folderService folder.Service, features featuremgmt.FeatureToggles) *LibraryElementService {
	l := &LibraryElementService{
		Cfg:           cfg,
		SQLStore:      sqlStore,
		RouteRegister: routeRegister,
		folderService: folderService,
		log:           log.New("library-elements"),
		features:      features,
	}
	l.registerAPIEndpoints()
	return l
}

// Service is a service for operating on library elements.
type Service interface {
	CreateElement(c context.Context, signedInUser *user.SignedInUser, cmd model.CreateLibraryElementCommand) (model.LibraryElementDTO, error)
	GetElement(c context.Context, signedInUser *user.SignedInUser, UID string) (model.LibraryElementDTO, error)
	GetElementsForDashboard(c context.Context, dashboardID int64) (map[string]model.LibraryElementDTO, error)
	ConnectElementsToDashboard(c context.Context, signedInUser *user.SignedInUser, elementUIDs []string, dashboardID int64) error
	DisconnectElementsFromDashboard(c context.Context, dashboardID int64) error
	DeleteLibraryElementsInFolder(c context.Context, signedInUser *user.SignedInUser, folderUID string) error
}

// LibraryElementService is the service for the Library Element feature.
type LibraryElementService struct {
	Cfg           *setting.Cfg
	SQLStore      db.DB
	RouteRegister routing.RouteRegister
	folderService folder.Service
	log           log.Logger
	features      featuremgmt.FeatureToggles
}

// CreateElement creates a Library Element.
func (l *LibraryElementService) CreateElement(c context.Context, signedInUser *user.SignedInUser, cmd model.CreateLibraryElementCommand) (model.LibraryElementDTO, error) {
	return l.createLibraryElement(c, signedInUser, cmd)
}

// GetElement gets an element from a UID.
func (l *LibraryElementService) GetElement(c context.Context, signedInUser *user.SignedInUser, UID string) (model.LibraryElementDTO, error) {
	return l.getLibraryElementByUid(c, signedInUser, UID)
}

// GetElementsForDashboard gets all connected elements for a specific dashboard.
func (l *LibraryElementService) GetElementsForDashboard(c context.Context, dashboardID int64) (map[string]model.LibraryElementDTO, error) {
	return l.getElementsForDashboardID(c, dashboardID)
}

// ConnectElementsToDashboard connects elements to a specific dashboard.
func (l *LibraryElementService) ConnectElementsToDashboard(c context.Context, signedInUser *user.SignedInUser, elementUIDs []string, dashboardID int64) error {
	return l.connectElementsToDashboardID(c, signedInUser, elementUIDs, dashboardID)
}

// DisconnectElementsFromDashboard disconnects elements from a specific dashboard.
func (l *LibraryElementService) DisconnectElementsFromDashboard(c context.Context, dashboardID int64) error {
	return l.disconnectElementsFromDashboardID(c, dashboardID)
}

// DeleteLibraryElementsInFolder deletes all elements for a specific folder.
func (l *LibraryElementService) DeleteLibraryElementsInFolder(c context.Context, signedInUser *user.SignedInUser, folderUID string) error {
	return l.deleteLibraryElementsInFolderUID(c, signedInUser, folderUID)
}
