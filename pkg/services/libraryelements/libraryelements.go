package libraryelements

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, routeRegister routing.RouteRegister, folderService folder.Service, features featuremgmt.FeatureToggles, ac accesscontrol.AccessControl, dashboardsService dashboards.DashboardService) *LibraryElementService {
	l := &LibraryElementService{
		Cfg:               cfg,
		SQLStore:          sqlStore,
		RouteRegister:     routeRegister,
		folderService:     folderService,
		dashboardsService: dashboardsService,
		log:               log.New("library-elements"),
		features:          features,
		AccessControl:     ac,
	}

	l.registerAPIEndpoints()
	ac.RegisterScopeAttributeResolver(LibraryPanelUIDScopeResolver(l, l.folderService))

	return l
}

// Service is a service for operating on library elements.
type Service interface {
	CreateElement(c context.Context, signedInUser identity.Requester, cmd model.CreateLibraryElementCommand) (model.LibraryElementDTO, error)
	GetElement(c context.Context, signedInUser identity.Requester, cmd model.GetLibraryElementCommand) (model.LibraryElementDTO, error)
	GetElementsForDashboard(c context.Context, dashboardID int64) (map[string]model.LibraryElementDTO, error)
	ConnectElementsToDashboard(c context.Context, signedInUser identity.Requester, elementUIDs []string, dashboardID int64) error
	DisconnectElementsFromDashboard(c context.Context, dashboardID int64) error
	DeleteLibraryElementsInFolder(c context.Context, signedInUser identity.Requester, folderUID string) error
	GetAllElements(c context.Context, signedInUser identity.Requester, query model.SearchLibraryElementsQuery) (model.LibraryElementSearchResult, error)
}

// LibraryElementService is the service for the Library Element feature.
type LibraryElementService struct {
	Cfg               *setting.Cfg
	SQLStore          db.DB
	RouteRegister     routing.RouteRegister
	folderService     folder.Service
	dashboardsService dashboards.DashboardService
	log               log.Logger
	features          featuremgmt.FeatureToggles
	AccessControl     accesscontrol.AccessControl
}

var _ Service = (*LibraryElementService)(nil)

// CreateElement creates a Library Element.
func (l *LibraryElementService) CreateElement(c context.Context, signedInUser identity.Requester, cmd model.CreateLibraryElementCommand) (model.LibraryElementDTO, error) {
	return l.createLibraryElement(c, signedInUser, cmd)
}

// GetElement gets an element from a UID.
func (l *LibraryElementService) GetElement(c context.Context, signedInUser identity.Requester, cmd model.GetLibraryElementCommand) (model.LibraryElementDTO, error) {
	return l.getLibraryElementByUid(c, signedInUser, cmd)
}

// GetElementsForDashboard gets all connected elements for a specific dashboard.
func (l *LibraryElementService) GetElementsForDashboard(c context.Context, dashboardID int64) (map[string]model.LibraryElementDTO, error) {
	return l.getElementsForDashboardID(c, dashboardID)
}

// ConnectElementsToDashboard connects elements to a specific dashboard.
func (l *LibraryElementService) ConnectElementsToDashboard(c context.Context, signedInUser identity.Requester, elementUIDs []string, dashboardID int64) error {
	return l.connectElementsToDashboardID(c, signedInUser, elementUIDs, dashboardID)
}

// DisconnectElementsFromDashboard disconnects elements from a specific dashboard.
func (l *LibraryElementService) DisconnectElementsFromDashboard(c context.Context, dashboardID int64) error {
	return l.disconnectElementsFromDashboardID(c, dashboardID)
}

// DeleteLibraryElementsInFolder deletes all elements for a specific folder.
func (l *LibraryElementService) DeleteLibraryElementsInFolder(c context.Context, signedInUser identity.Requester, folderUID string) error {
	return l.deleteLibraryElementsInFolderUID(c, signedInUser, folderUID)
}

// GetAll gets all library elements with support to query filters.
func (l *LibraryElementService) GetAllElements(c context.Context, signedInUser identity.Requester, query model.SearchLibraryElementsQuery) (model.LibraryElementSearchResult, error) {
	return l.getAllLibraryElements(c, signedInUser, query)
}

func (l *LibraryElementService) addUidToLibraryPanel(model []byte, newUid string) (json.RawMessage, error) {
	var modelMap map[string]any
	err := json.Unmarshal(model, &modelMap)
	if err != nil {
		return nil, err
	}

	if libraryPanel, ok := modelMap["libraryPanel"].(map[string]any); ok {
		if uid, ok := libraryPanel["uid"]; ok && uid == "" {
			libraryPanel["uid"] = newUid
		}
	}

	updatedModel, err := json.Marshal(modelMap)
	if err != nil {
		return nil, err
	}

	return updatedModel, nil
}
