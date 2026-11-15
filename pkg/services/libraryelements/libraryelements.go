package libraryelements

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, routeRegister routing.RouteRegister, folderService folder.Service, features featuremgmt.FeatureToggles, ac accesscontrol.AccessControl, dashboardsService dashboards.DashboardService, clientConfigProvider grafanaapiserver.DirectRestConfigProvider, userService user.Service) *LibraryElementService {
	l := &LibraryElementService{
		Cfg:                       cfg,
		SQLStore:                  sqlStore,
		RouteRegister:             routeRegister,
		folderService:             folderService,
		dashboardsService:         dashboardsService,
		ConnectedDashboardsFinder: dashboardsService,
		log:                       log.New("library-elements"),
		features:                  features,
		AccessControl:             ac,
		k8sHandler:                newLibraryElementsK8sHandler(cfg, clientConfigProvider, folderService, userService, dashboardsService),
		// LegacyDatabaseProvider is left unset here: it must stay nil unless a deployment
		// explicitly configures a routed database (see legacyDatabaseProvider).
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	l.treeCache = newFolderTreeCache(folderService, features != nil && features.IsEnabledGlobally(featuremgmt.FlagLibraryElementsFolderTreeViaSearch))

	if routeRegister != nil {
		l.registerAPIEndpoints()
	}
	if folderService != nil {
		ac.RegisterScopeAttributeResolver(LibraryPanelUIDScopeResolver(l, l.folderService))
	}
	return l
}

// Service is a service for operating on library elements.
type Service interface {
	CreateElement(c context.Context, signedInUser identity.Requester, cmd model.CreateLibraryElementCommand) (model.LibraryElementDTO, error)
	PatchLibraryElement(c context.Context, signedInUser identity.Requester, cmd model.PatchLibraryElementCommand, uid string) (model.LibraryElementDTO, error)
	DeleteLibraryElement(c context.Context, signedInUser identity.Requester, uid string) (int64, error)
	GetElement(c context.Context, signedInUser identity.Requester, cmd model.GetLibraryElementCommand) (model.LibraryElementDTO, error)
	DeleteLibraryElementsInFolder(c context.Context, signedInUser identity.Requester, folderUID string) error
	DeleteLibraryElementsInFolderUnchecked(c context.Context, orgID int64, signedInUser identity.Requester, folderUID string) error
	RequireEditPermissionsOnFolder(ctx context.Context, user identity.Requester, folderUID string) error
	GetAllElements(c context.Context, signedInUser identity.Requester, query model.SearchLibraryElementsQuery) (model.LibraryElementSearchResult, error)
}

// ConnectedDashboardsFinder finds dashboards that still reference a library panel, so folder delete
// can refuse to remove a panel still in use outside the folder being deleted. Satisfied by
// dashboards.DashboardService; a deployment without a local DashboardService (e.g. a folder
// apiserver running standalone) can supply an adapter backed by the dashboard apiserver instead.
type ConnectedDashboardsFinder interface {
	GetDashboardsByLibraryPanelUID(ctx context.Context, libraryPanelUID string, orgID int64) ([]*dashboards.DashboardRef, error)
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
	k8sHandler        *libraryElementsK8sHandler
	treeCache         *folderTreeCache
	// LegacyDatabaseProvider selects the connection and table name for folder-deletion queries. If
	// unset, those queries use SQLStore and bare table names.
	LegacyDatabaseProvider legacysql.LegacyDatabaseProvider
	// ConnectedDashboardsFinder is used by the folder-delete path to check whether a library panel is
	// still referenced outside the folder being deleted. ProvideService defaults this to
	// dashboardsService; any other construction must set it explicitly or folder deletes
	// containing library elements fail with ErrConnectedDashboardsFinderNotConfigured.
	ConnectedDashboardsFinder ConnectedDashboardsFinder
}

var _ Service = (*LibraryElementService)(nil)

// withoutAmbientSession forces a fresh session, since sqlstore reuses whatever's on ctx without
// checking it came from the right db.DB.
func withoutAmbientSession(ctx context.Context) context.Context {
	return context.WithValue(ctx, sqlstore.ContextSessionKey{}, nil)
}

// GetElement gets an element from a UID.
func (l *LibraryElementService) GetElement(c context.Context, signedInUser identity.Requester, cmd model.GetLibraryElementCommand) (model.LibraryElementDTO, error) {
	return l.getLibraryElementByUid(c, signedInUser, cmd, nil)
}

// DeleteLibraryElementsInFolder deletes all elements for a specific folder.
func (l *LibraryElementService) DeleteLibraryElementsInFolder(c context.Context, signedInUser identity.Requester, folderUID string) error {
	return l.deleteLibraryElementsInFolderUID(c, signedInUser, folderUID)
}

// DeleteLibraryElementsInFolderUnchecked is DeleteLibraryElementsInFolder without the edit-
// permission check, for callers that have already authorized the requester through a different
// mechanism (e.g. a standalone folder apiserver's cascade delete) and marked ctx with
// folder.WithUncheckedDeleteAuthorized to prove it. orgID is explicit since it isn't guaranteed to
// match signedInUser.GetOrgID() for every caller.
func (l *LibraryElementService) DeleteLibraryElementsInFolderUnchecked(c context.Context, orgID int64, signedInUser identity.Requester, folderUID string) error {
	if err := folder.RequireUncheckedDeleteAuthorized(c, orgID, signedInUser, []string{folderUID}); err != nil {
		return err
	}
	// Attach the requester so a routed LegacyDatabaseProvider can resolve the target database.
	return l.deleteLibraryElementsInFolderUIDUnchecked(identity.WithRequester(c, signedInUser), orgID, folderUID)
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
