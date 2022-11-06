package folderimpl

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	f "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	log              log.Logger
	cfg              *setting.Cfg
	dashboardService dashboards.DashboardService
	dashboardStore   dashboards.Store
	searchService    *search.SearchService
	features         featuremgmt.FeatureToggles
	permissions      accesscontrol.FolderPermissionsService

	// bus is currently used to publish events that cause scheduler to update rules.
	bus bus.Bus
}

func ProvideService(
	ac accesscontrol.AccessControl,
	bus bus.Bus,
	cfg *setting.Cfg,
	dashboardService dashboards.DashboardService,
	dashboardStore dashboards.Store,
	features featuremgmt.FeatureToggles,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	searchService *search.SearchService,
) folder.Service {
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderNameScopeResolver(dashboardStore))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderIDScopeResolver(dashboardStore))
	return &Service{
		cfg:              cfg,
		log:              log.New("folder-service"),
		dashboardService: dashboardService,
		dashboardStore:   dashboardStore,
		searchService:    searchService,
		features:         features,
		permissions:      folderPermissionsService,
		bus:              bus,
	}
}

func (s *Service) GetFolders(ctx context.Context, user *user.SignedInUser, orgID int64, limit int64, page int64) ([]*models.Folder, error) {
	searchQuery := search.Query{
		SignedInUser: user,
		DashboardIds: make([]int64, 0),
		FolderIds:    make([]int64, 0),
		Limit:        limit,
		OrgId:        orgID,
		Type:         "dash-folder",
		Permission:   models.PERMISSION_VIEW,
		Page:         page,
	}

	if err := s.searchService.SearchHandler(ctx, &searchQuery); err != nil {
		return nil, err
	}

	folders := make([]*models.Folder, 0)

	for _, hit := range searchQuery.Result {
		folders = append(folders, &models.Folder{
			Id:    hit.ID,
			Uid:   hit.UID,
			Title: hit.Title,
		})
	}

	return folders, nil
}

func (s *Service) GetFolderByID(ctx context.Context, user *user.SignedInUser, id int64, orgID int64) (*models.Folder, error) {
	if id == 0 {
		return &models.Folder{Id: id, Title: "General"}, nil
	}

	dashFolder, err := s.dashboardStore.GetFolderByID(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	g := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	return dashFolder, nil
}

func (s *Service) GetFolderByUID(ctx context.Context, user *user.SignedInUser, orgID int64, uid string) (*models.Folder, error) {
	dashFolder, err := s.dashboardStore.GetFolderByUID(ctx, orgID, uid)
	if err != nil {
		return nil, err
	}

	g := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	return dashFolder, nil
}

func (s *Service) GetFolderByTitle(ctx context.Context, user *user.SignedInUser, orgID int64, title string) (*models.Folder, error) {
	dashFolder, err := s.dashboardStore.GetFolderByTitle(ctx, orgID, title)
	if err != nil {
		return nil, err
	}

	g := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	return dashFolder, nil
}

func (s *Service) CreateFolder(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, toFolderError(err)
	}
	dashFolder := models.NewDashboardFolder(cmd.Title)
	dashFolder.OrgId = user.OrgID

	trimmedUID := strings.TrimSpace(cmd.UID)
	if trimmedUID == accesscontrol.GeneralFolderUID {
		return nil, dashboards.ErrFolderInvalidUID
	}

	dashFolder.SetUid(trimmedUID)
	userID := user.UserID
	if userID == 0 {
		userID = -1
	}
	dashFolder.CreatedBy = userID
	dashFolder.UpdatedBy = userID
	dashFolder.UpdateSlug()

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgId:     user.OrgID,
		User:      user,
	}

	saveDashboardCmd, err := s.dashboardService.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := s.dashboardStore.SaveDashboard(ctx, *saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	var modelFolder *models.Folder
	modelFolder, err = s.dashboardStore.GetFolderByID(ctx, user.OrgID, dash.Id)
	if err != nil {
		return nil, err
	}
	if modelFolder == nil {
		return nil, nil
	}
	folder := f.ConvertModelFolderToFolder(modelFolder)

	var permissionErr error
	if !accesscontrol.IsDisabled(s.cfg) {
		var permissions []accesscontrol.SetResourcePermissionCommand
		if user.IsRealUser() && !user.IsAnonymous {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: userID, Permission: models.PERMISSION_ADMIN.String(),
			})
		}

		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: models.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: models.PERMISSION_VIEW.String()},
		}...)

		_, permissionErr = s.permissions.SetPermissions(ctx, user.OrgID, folder.UID, permissions...)
	} else if s.cfg.EditorsCanAdmin && user.IsRealUser() && !user.IsAnonymous {
		permissionErr = s.MakeUserAdmin(ctx, user.OrgID, userID, folder.ID, true)
	}

	if permissionErr != nil {
		s.log.Error("Could not make user admin", "folder", folder.Title, "user", userID, "error", permissionErr)
	}

	return folder, nil
}

func (s *Service) UpdateFolder(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	query := models.GetDashboardQuery{OrgId: cmd.Folder.OrgID, Uid: cmd.Folder.UID}
	if _, err := s.dashboardStore.GetDashboard(ctx, &query); err != nil {
		return nil, toFolderError(err)
	}

	dashFolder := query.Result
	currentTitle := dashFolder.Title

	if !dashFolder.IsFolder {
		return nil, dashboards.ErrFolderNotFound
	}

	user, err := appcontext.User(ctx)
	cmd.UpdateDashboardModel(dashFolder, cmd.Folder.OrgID, user.UserID)

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgId:     cmd.Folder.OrgID,
		User:      user,
		Overwrite: cmd.Overwrite,
	}

	saveDashboardCmd, err := s.dashboardService.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := s.dashboardStore.SaveDashboard(ctx, *saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	var modelFolder *models.Folder
	modelFolder, err = s.dashboardStore.GetFolderByID(ctx, user.OrgID, dash.Id)
	if err != nil {
		return nil, err
	}
	if modelFolder == nil {
		return nil, nil
	}
	folder := f.ConvertModelFolderToFolder(modelFolder)
	cmd.Folder = folder

	if currentTitle != folder.Title {
		if err := s.bus.Publish(ctx, &events.FolderTitleUpdated{
			Timestamp: folder.Updated,
			Title:     folder.Title,
			ID:        dash.Id,
			UID:       dash.Uid,
			OrgID:     user.OrgID,
		}); err != nil {
			s.log.Error("failed to publish FolderTitleUpdated event", "folder", folder.Title, "user", user.UserID, "error", err)
		}
	}

	return cmd.Folder, nil
}

func (s *Service) DeleteFolder(ctx context.Context, cmd *folder.DeleteFolderCommand) (*folder.Folder, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	dashFolder, err := s.dashboardStore.GetFolderByUID(ctx, user.OrgID, cmd.UID)
	if err != nil {
		return nil, err
	}

	guard := guardian.New(ctx, dashFolder.Id, user.OrgID, user)
	if canSave, err := guard.CanDelete(); err != nil || !canSave {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}
	if dashFolder == nil {
		return nil, nil
	}
	folder := f.ConvertModelFolderToFolder(dashFolder)

	deleteCmd := models.DeleteDashboardCommand{OrgId: user.OrgID, Id: dashFolder.Id, ForceDeleteFolderRules: cmd.ForceDeleteRules}

	if err := s.dashboardStore.DeleteDashboard(ctx, &deleteCmd); err != nil {
		return nil, toFolderError(err)
	}

	return folder, nil
}

func (s *Service) MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error {
	return s.dashboardService.MakeUserAdmin(ctx, orgID, userID, folderID, setViewAndEditPermissions)
}

func toFolderError(err error) error {
	if errors.Is(err, dashboards.ErrDashboardTitleEmpty) {
		return dashboards.ErrFolderTitleEmpty
	}

	if errors.Is(err, dashboards.ErrDashboardUpdateAccessDenied) {
		return dashboards.ErrFolderAccessDenied
	}

	if errors.Is(err, dashboards.ErrDashboardWithSameNameInFolderExists) {
		return dashboards.ErrFolderSameNameExists
	}

	if errors.Is(err, dashboards.ErrDashboardWithSameUIDExists) {
		return dashboards.ErrFolderWithSameUIDExists
	}

	if errors.Is(err, dashboards.ErrDashboardVersionMismatch) {
		return dashboards.ErrFolderVersionMismatch
	}

	if errors.Is(err, dashboards.ErrDashboardNotFound) {
		return dashboards.ErrFolderNotFound
	}

	if errors.Is(err, dashboards.ErrDashboardFailedGenerateUniqueUid) {
		err = dashboards.ErrFolderFailedGenerateUniqueUid
	}

	return err
}
