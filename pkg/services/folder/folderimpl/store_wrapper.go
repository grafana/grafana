package folderimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
)

// storeWrapper is a temporary thin wrapper
// implementing the store interface.
// Write operations call of both the dashboard and folder stores
// while read operations call either the dashboard or the folder store
// depending whether the nested folders are enabled or not
type storeWrapper struct {
	dashboardStore      dashboards.Store
	folderStore         store
	dashboardService    dashboards.DashboardService
	log                 log.Logger
	nestedFolderEnabled bool
}

func ProvideStoreWrapper(
	cfg *setting.Cfg,
	dashboardService dashboards.DashboardService,
	dashboardStore dashboards.Store,
	folderStore store) storeWrapper {
	return storeWrapper{
		dashboardService:    dashboardService,
		dashboardStore:      dashboardStore,
		folderStore:         folderStore,
		nestedFolderEnabled: cfg.IsFeatureToggleEnabled(featuremgmt.FlagNestedFolders),
		log:                 log.New("folder-store-wrapper"),
	}
}

func (s storeWrapper) Get(ctx context.Context, cmd folder.GetFolderQuery) (*folder.Folder, error) {
	if s.nestedFolderEnabled {
		return s.folderStore.Get(ctx, cmd)
	}

	switch {
	case cmd.UID != nil:
		return s.dashboardStore.GetFolderByUID(ctx, cmd.OrgID, *cmd.UID)
	case cmd.ID != nil:
		if *cmd.ID == int64(0) {
			return &folder.Folder{ID: 0, Title: "General"}, nil
		}
		return s.dashboardStore.GetFolderByID(ctx, *cmd.ID, cmd.OrgID)
	case cmd.Title != nil:
		return s.dashboardStore.GetFolderByTitle(ctx, cmd.OrgID, *cmd.Title)
	default:
		return nil, folder.ErrBadRequest.Errorf("either on of UID, ID, Title fields must be present")
	}
}

/*
func (s storeWrapper) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	dash, err := s.legacyCreate(ctx, cmd)
	if err != nil {
		return nil, err
	}

	var description string
	if dash.Data != nil {
		description = dash.Data.Get("description").MustString()
	}

	parentUID := folder.RootFolderUID
	if cmd.ParentUID != "" {
		parentUID = cmd.ParentUID
	}

	if _, err := s.folderStore.Create(ctx, folder.CreateFolderCommand{
		// TODO: Today, if a UID isn't specified, the dashboard store
		// generates a new UID. The new folder store will need to do this as
		// well, but for now we take the UID from the newly created folder.
		UID:         dash.Uid,
		OrgID:       cmd.OrgID,
		Title:       cmd.Title,
		Description: description,
		ParentUID:   parentUID,
	}); err != nil {
		logger := s.log.FromContext(ctx)
		// We'll log the error and also roll back the previously-created
		// (legacy) folder.
		logger.Error("error saving folder to nested folder store", err)
		if err := s.dashboardStore.DeleteDashboard(ctx, &models.DeleteDashboardCommand{OrgId: cmd.OrgID, Id: dash.Id, ForceDeleteFolderRules: true}); err != nil {
			logger.Error("error deleting folder after failed save to nested folder store", err)
		}
		return nil, err
	}
	// The folder UID is specified (or generated) during creation, so we'll
	// stop here and return the created model.Folder.

	return s.Get(ctx, folder.GetFolderQuery{OrgID: cmd.OrgID, ID: &dash.Id})
}

func (s storeWrapper) legacyCreate(ctx context.Context, cmd *folder.CreateFolderCommand) (*models.Dashboard, error) {
	dashFolder := models.NewDashboardFolder(cmd.Title)
	dashFolder.OrgId = cmd.OrgID

	trimmedUID := strings.TrimSpace(cmd.UID)
	if trimmedUID == accesscontrol.GeneralFolderUID {
		return nil, dashboards.ErrFolderInvalidUID
	}
	dashFolder.SetUid(trimmedUID)

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	userID := user.UserID
	if userID == 0 {
		userID = -1
	}
	dashFolder.CreatedBy = userID
	dashFolder.UpdatedBy = userID
	dashFolder.UpdateSlug()

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgId:     cmd.OrgID,
		User:      user,
	}

	saveDashboardCmd, err := s.dashboardService.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, toFolderError(err)
	}
	dash, err := s.dashboardStore.SaveDashboard(ctx, saveDashboardCmd)
	if err != nil {
		return nil, err
	}

	return dash, err
}

func (s storeWrapper) Delete(ctx context.Context, uid string, orgID int64) error {
	f, err := s.Get(ctx, folder.GetFolderQuery{OrgID: orgID, UID: &uid})
	if err != nil {
		return err
	}

	if err = s.dashboardStore.DeleteDashboard(ctx, &models.DeleteDashboardCommand{
		Id:    f.ID,
		OrgId: f.OrgID,
	}); err != nil {
		return err
	}

	if err := s.folderStore.Delete(ctx, uid, orgID); err != nil {
		return err
	}

	return nil
}

func (s storeWrapper) Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {

}

func (s storeWrapper) Get(ctx context.Context, cmd folder.GetFolderQuery) (*folder.Folder, error) {
	if s.nestedFolderEnabled {
		return s.folderStore.Get(ctx, cmd)
	}

	switch {
	case cmd.UID != nil:
		return s.dashboardStore.GetFolderByUID(ctx, cmd.OrgID, *cmd.UID)
	case cmd.ID != nil:
		if *cmd.ID == int64(0) {
			return &folder.Folder{ID: 0, Title: "General"}, nil
		}
		return s.dashboardStore.GetFolderByID(ctx, *cmd.ID, cmd.OrgID)
	case cmd.Title != nil:
		return s.dashboardStore.GetFolderByTitle(ctx, cmd.OrgID, *cmd.Title)
	default:
		return nil, folder.ErrBadRequest.Errorf("either on of UID, ID, Title fields must be present")
	}
}

func (s storeWrapper) GetParents(ctx context.Context, cmd folder.GetParentsQuery) ([]*folder.Folder, error) {
	if !s.nestedFolderEnabled {
		return nil, folder.ErrNestedFoldersNotEnabled
	}
	return s.folderStore.GetParents(ctx, cmd)
}

func (s storeWrapper) GetChildren(ctx context.Context, cmd folder.GetTreeQuery) ([]*folder.Folder, error) {
	if !s.nestedFolderEnabled {
		return nil, folder.ErrNestedFoldersNotEnabled
	}
	return s.folderStore.GetChildren(ctx, cmd)
}
*/
