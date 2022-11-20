package folderimpl

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
		return s.dashboardStore.GetFolderByID(ctx, *&cmd.OrgID, *cmd.ID)
	case cmd.Title != nil:
		return s.dashboardStore.GetFolderByTitle(ctx, cmd.OrgID, *cmd.Title)
	default:
		return nil, folder.ErrBadRequest.Errorf("either on of UID, ID, Title fields must be present")
	}
}

func (s storeWrapper) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	dashFolder, err := s.legacyCreate(ctx, cmd)
	if err != nil {
		return nil, err
	}

	if s.nestedFolderEnabled {
		parentUID := folder.RootFolderUID
		if cmd.ParentUID != "" {
			parentUID = cmd.ParentUID
		}

		_, err = s.folderStore.Create(ctx, folder.CreateFolderCommand{
			// The ID should be the same in both stores so that access control is working as expected
			// (dashboard_acl.dashboard_id)
			ID: dashFolder.ID,
			// TODO: Today, if a UID isn't specified, the dashboard store
			// generates a new UID. The new folder store will need to do this as
			// well, but for now we take the UID from the newly created folder.
			UID:         dashFolder.UID,
			OrgID:       cmd.OrgID,
			Title:       cmd.Title,
			Description: cmd.Description,
			ParentUID:   parentUID,
		})

		if err != nil {
			logger := s.log.FromContext(ctx)
			// We'll log the error and also roll back the previously-created
			// (legacy) folder.
			logger.Error("error saving folder to nested folder store", err)
			// since the folder was created by this operation no need to check for permission to delete it
			deleteCmd := &models.DeleteDashboardCommand{OrgId: cmd.OrgID, Id: dashFolder.ID, ForceDeleteFolderRules: true}
			deleteErr := s.dashboardStore.DeleteDashboard(ctx, deleteCmd)
			if deleteErr != nil {
				logger.Error("error deleting folder after failed save to nested folder store", err)
			}
			return dashFolder, err
		}
		// The folder UID is specified (or generated) during creation, so we'll
		// stop here and return the created model.Folder.
	}

	return dashFolder, nil
}

func (s storeWrapper) Delete(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	logger := s.log.FromContext(ctx)
	if s.nestedFolderEnabled {
		if err := s.nestedFolderDelete(ctx, cmd); err != nil {
			logger.Error("deleting folder on folder table failed", "err", err.Error())
		}
	}

	return s.legacyDelete(ctx, cmd)
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

func (s storeWrapper) Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {
	var foldr *folder.Folder
	var err error
	if !cmd.IsMoveCmd() {
		foldr, err = s.legacyUpdate(ctx, cmd)
		if err != nil {
			return nil, err
		}
	}

	if s.nestedFolderEnabled {
		foldr, err = s.folderStore.Update(ctx, cmd)
		if err != nil {
			return nil, err
		}
	}
	return foldr, nil
}

func (s storeWrapper) legacyCreate(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
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

	// performs several validations/permission checks
	saveDashboardCmd, err := s.dashboardService.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := s.dashboardStore.SaveDashboard(ctx, *saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	createdFolder, err := s.dashboardStore.GetFolderByID(ctx, cmd.OrgID, dash.Id)
	if err != nil {
		return nil, err
	}

	return createdFolder, nil
}

func (s storeWrapper) legacyDelete(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	dashFolder, err := s.Get(ctx, folder.GetFolderQuery{OrgID: cmd.OrgID, UID: &cmd.UID})
	if err != nil {
		return err
	}

	deleteCmd := models.DeleteDashboardCommand{OrgId: cmd.OrgID, Id: dashFolder.ID, ForceDeleteFolderRules: cmd.ForceDeleteRules}
	return s.dashboardStore.DeleteDashboard(ctx, &deleteCmd)
}

func (s storeWrapper) nestedFolderDelete(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	folders, err := s.folderStore.GetChildren(ctx, folder.GetTreeQuery{UID: cmd.UID, OrgID: cmd.OrgID})
	if err != nil {
		return err
	}
	for _, f := range folders {
		err := s.nestedFolderDelete(ctx, &folder.DeleteFolderCommand{UID: f.UID, OrgID: f.OrgID, ForceDeleteRules: cmd.ForceDeleteRules})
		if err != nil {
			return err
		}
	}
	err = s.folderStore.Delete(ctx, cmd.UID, cmd.OrgID)
	if err != nil {
		return err
	}
	return nil
}

func (s storeWrapper) legacyUpdate(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {
	query := models.GetDashboardQuery{OrgId: cmd.Folder.OrgID, Uid: cmd.Folder.UID}
	dashFolder, err := s.dashboardStore.GetDashboard(ctx, &query)
	if err != nil {
		return nil, toFolderError(err)
	}

	if !dashFolder.IsFolder {
		return nil, dashboards.ErrFolderNotFound
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	legacyUpdateCmd := &models.UpdateFolderCommand{}
	if cmd.NewUID != nil {
		legacyUpdateCmd.Uid = *cmd.NewUID
	}

	if cmd.NewDescription != nil {
		legacyUpdateCmd.Description = *cmd.NewDescription
	}

	if cmd.NewTitle != nil {
		legacyUpdateCmd.Title = *cmd.NewTitle
	}

	legacyUpdateCmd.UpdateDashboardModel(dashFolder, cmd.Folder.OrgID, user.UserID)

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgId:     cmd.Folder.OrgID,
		User:      user,
		Overwrite: legacyUpdateCmd.Overwrite,
	}
	saveDashboardCmd, err := s.dashboardService.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := s.dashboardStore.SaveDashboard(ctx, *saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	return s.dashboardStore.GetFolderByID(ctx, cmd.Folder.OrgID, dash.Id)
}
