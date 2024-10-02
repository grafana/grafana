package folderimpl

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/dskit/concurrency"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/exp/slices"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const FULLPATH_SEPARATOR = "/"

type Service struct {
	store                folder.Store
	db                   db.DB
	log                  *slog.Logger
	dashboardStore       dashboards.Store
	dashboardFolderStore folder.FolderStore
	features             featuremgmt.FeatureToggles
	cfg                  *setting.Cfg
	folderPermissions    accesscontrol.FolderPermissionsService
	accessControl        accesscontrol.AccessControl
	// bus is currently used to publish event in case of folder full path change.
	// For example when a folder is moved to another folder or when a folder is renamed.
	bus bus.Bus

	mutex    sync.RWMutex
	registry map[string]folder.RegistryService
	metrics  *foldersMetrics
	tracer   tracing.Tracer
}

func ProvideService(
	store *FolderStoreImpl,
	ac accesscontrol.AccessControl,
	bus bus.Bus,
	dashboardStore dashboards.Store,
	folderStore folder.FolderStore,
	db db.DB, // DB for the (new) nested folder store
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	folderPermissions accesscontrol.FolderPermissionsService,
	supportBundles supportbundles.Service,
	r prometheus.Registerer,
	tracer tracing.Tracer,
) folder.Service {
	srv := &Service{
		log:                  slog.Default().With("logger", "folder-service"),
		dashboardStore:       dashboardStore,
		dashboardFolderStore: folderStore,
		store:                store,
		features:             features,
		cfg:                  cfg,
		folderPermissions:    folderPermissions,
		accessControl:        ac,
		bus:                  bus,
		db:                   db,
		registry:             make(map[string]folder.RegistryService),
		metrics:              newFoldersMetrics(r),
		tracer:               tracer,
	}
	srv.DBMigration(db)

	supportBundles.RegisterSupportItemCollector(srv.supportBundleCollector())

	ac.RegisterScopeAttributeResolver(dashboards.NewFolderNameScopeResolver(folderStore, store))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderIDScopeResolver(folderStore, store))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderUIDScopeResolver(store))
	return srv
}

func (s *Service) DBMigration(db db.DB) {
	s.log.Debug("syncing dashboard and folder tables started")

	ctx := context.Background()
	err := db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		if db.GetDialect().DriverName() == migrator.SQLite {
			// covered by UQE_folder_org_id_uid
			_, err = sess.Exec(`
				INSERT INTO folder (uid, org_id, title, created, updated)
				SELECT uid, org_id, title, created, updated FROM dashboard WHERE is_folder = 1
				ON CONFLICT DO UPDATE SET title=excluded.title, updated=excluded.updated
			`)
		} else if db.GetDialect().DriverName() == migrator.Postgres {
			// covered by UQE_folder_org_id_uid
			_, err = sess.Exec(`
				INSERT INTO folder (uid, org_id, title, created, updated)
				SELECT uid, org_id, title, created, updated FROM dashboard WHERE is_folder = true
				ON CONFLICT(uid, org_id) DO UPDATE SET title=excluded.title, updated=excluded.updated
			`)
		} else {
			// covered by UQE_folder_org_id_uid
			_, err = sess.Exec(`
				INSERT INTO folder (uid, org_id, title, created, updated)
				SELECT * FROM (SELECT uid, org_id, title, created, updated FROM dashboard WHERE is_folder = 1) AS derived
				ON DUPLICATE KEY UPDATE title=derived.title, updated=derived.updated
			`)
		}
		if err != nil {
			return err
		}

		// covered by UQE_folder_org_id_uid
		_, err = sess.Exec(`
			DELETE FROM folder WHERE NOT EXISTS
				(SELECT 1 FROM dashboard WHERE dashboard.uid = folder.uid AND dashboard.org_id = folder.org_id AND dashboard.is_folder = true)
		`)
		return err
	})
	if err != nil {
		s.log.Error("DB migration on folder service start failed.", "err", err)
	}

	s.log.Debug("syncing dashboard and folder tables finished")
}

func (s *Service) GetFolders(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	if q.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	qry := folder.NewGetFoldersQuery(q)
	permissions := q.SignedInUser.GetPermissions()
	folderPermissions := permissions[dashboards.ActionFoldersRead]
	qry.AncestorUIDs = make([]string, 0, len(folderPermissions))
	if len(folderPermissions) == 0 && !q.SignedInUser.GetIsGrafanaAdmin() {
		return nil, nil
	}
	for _, p := range folderPermissions {
		if p == dashboards.ScopeFoldersAll {
			// no need to query for folders with permissions
			// the user has permission to access all folders
			qry.AncestorUIDs = nil
			break
		}
		if folderUid, found := strings.CutPrefix(p, dashboards.ScopeFoldersPrefix); found {
			if !slices.Contains(qry.AncestorUIDs, folderUid) {
				qry.AncestorUIDs = append(qry.AncestorUIDs, folderUid)
			}
		}
	}

	if !s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) {
		qry.WithFullpath = false // do not request full path if nested folders are disabled
		qry.WithFullpathUIDs = false
	}

	dashFolders, err := s.store.GetFolders(ctx, qry)
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders: %w", err)
	}

	if !s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) {
		if q.WithFullpathUIDs || q.WithFullpath {
			for _, f := range dashFolders { // and fix the full path with folder title (unescaped)
				if q.WithFullpath {
					f.Fullpath = f.Title
				}
				if q.WithFullpathUIDs {
					f.FullpathUIDs = f.UID
				}
			}
		}
	}

	return dashFolders, nil
}

func (s *Service) Get(ctx context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	if q.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	if q.UID != nil && *q.UID == accesscontrol.GeneralFolderUID {
		return folder.RootFolder, nil
	}

	if s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) && q.UID != nil && *q.UID == folder.SharedWithMeFolderUID {
		return folder.SharedWithMeFolder.WithURL(), nil
	}

	var dashFolder *folder.Folder
	var err error
	switch {
	case q.UID != nil:
		if *q.UID == "" {
			return &folder.GeneralFolder, nil
		}
		dashFolder, err = s.getFolderByUID(ctx, q.OrgID, *q.UID)
		if err != nil {
			return nil, err
		}
	// nolint:staticcheck
	case q.ID != nil:
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
		dashFolder, err = s.getFolderByID(ctx, *q.ID, q.OrgID)
		if err != nil {
			return nil, err
		}
	case q.Title != nil:
		dashFolder, err = s.getFolderByTitle(ctx, q.OrgID, *q.Title, q.ParentUID)
		if err != nil {
			return nil, err
		}
	default:
		return nil, folder.ErrBadRequest.Errorf("either on of UID, ID, Title fields must be present")
	}

	if dashFolder.IsGeneral() {
		return dashFolder, nil
	}

	// do not get guardian by the folder ID because it differs from the nested folder ID
	// and the legacy folder ID has been associated with the permissions:
	// use the folde UID instead that is the same for both
	g, err := guardian.NewByFolder(ctx, dashFolder, dashFolder.OrgID, q.SignedInUser)
	if err != nil {
		return nil, err
	}

	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	if !s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) {
		dashFolder.Fullpath = dashFolder.Title
		return dashFolder, nil
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
	// nolint:staticcheck
	if q.ID != nil {
		q.ID = nil
		q.UID = &dashFolder.UID
	}

	f, err := s.store.Get(ctx, *q)
	if err != nil {
		return nil, err
	}

	// always expose the dashboard store sequential ID
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
	// nolint:staticcheck
	f.ID = dashFolder.ID
	f.Version = dashFolder.Version

	if !s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) {
		f.Fullpath = f.Title // set full path to the folder title (unescaped)
	}

	return f, err
}

func (s *Service) GetChildren(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.Folder, error) {
	defer func(t time.Time) {
		parent := q.UID
		if q.UID != folder.SharedWithMeFolderUID {
			parent = "folder"
		}
		s.metrics.foldersGetChildrenRequestsDuration.WithLabelValues(parent).Observe(time.Since(t).Seconds())
	}(time.Now())

	if q.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	if s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) && q.UID == folder.SharedWithMeFolderUID {
		return s.GetSharedWithMe(ctx, q)
	}

	if q.UID == "" {
		return s.getRootFolders(ctx, q)
	}

	// we only need to check access to the folder
	// if the parent is accessible then the subfolders are accessible as well (due to inheritance)
	g, err := guardian.NewByUID(ctx, q.UID, q.OrgID, q.SignedInUser)
	if err != nil {
		return nil, err
	}

	guardianFunc := g.CanView
	if q.Permission == dashboardaccess.PERMISSION_EDIT {
		guardianFunc = g.CanEdit
	}

	hasAccess, err := guardianFunc()
	if err != nil {
		return nil, err
	}
	if !hasAccess {
		return nil, dashboards.ErrFolderAccessDenied
	}

	children, err := s.store.GetChildren(ctx, *q)
	if err != nil {
		return nil, err
	}

	childrenUIDs := make([]string, 0, len(children))
	for _, f := range children {
		childrenUIDs = append(childrenUIDs, f.UID)
	}

	dashFolders, err := s.dashboardFolderStore.GetFolders(ctx, q.OrgID, childrenUIDs)
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders from dashboard store: %w", err)
	}

	for _, f := range children {
		// fetch folder from dashboard store
		dashFolder, ok := dashFolders[f.UID]
		if !ok {
			s.log.Error("failed to fetch folder by UID from dashboard store", "uid", f.UID)
			continue
		}

		// always expose the dashboard store sequential ID
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
		// nolint:staticcheck
		f.ID = dashFolder.ID
	}

	return children, nil
}

func (s *Service) getRootFolders(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.Folder, error) {
	permissions := q.SignedInUser.GetPermissions()
	var folderPermissions []string
	if q.Permission == dashboardaccess.PERMISSION_EDIT {
		folderPermissions = permissions[dashboards.ActionFoldersWrite]
	} else {
		folderPermissions = permissions[dashboards.ActionFoldersRead]
	}

	if len(folderPermissions) == 0 && !q.SignedInUser.GetIsGrafanaAdmin() {
		return nil, nil
	}

	q.FolderUIDs = make([]string, 0, len(folderPermissions))
	for _, p := range folderPermissions {
		if p == dashboards.ScopeFoldersAll {
			// no need to query for folders with permissions
			// the user has permission to access all folders
			q.FolderUIDs = nil
			break
		}
		if folderUid, found := strings.CutPrefix(p, dashboards.ScopeFoldersPrefix); found {
			if !slices.Contains(q.FolderUIDs, folderUid) {
				q.FolderUIDs = append(q.FolderUIDs, folderUid)
			}
		}
	}

	children, err := s.store.GetChildren(ctx, *q)
	if err != nil {
		return nil, err
	}

	childrenUIDs := make([]string, 0, len(children))
	for _, f := range children {
		childrenUIDs = append(childrenUIDs, f.UID)
	}

	dashFolders, err := s.dashboardFolderStore.GetFolders(ctx, q.OrgID, childrenUIDs)
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders from dashboard store: %w", err)
	}

	if err := concurrency.ForEachJob(ctx, len(children), runtime.NumCPU(), func(ctx context.Context, i int) error {
		f := children[i]
		// fetch folder from dashboard store
		dashFolder, ok := dashFolders[f.UID]
		if !ok {
			s.log.Error("failed to fetch folder by UID from dashboard store", "orgID", f.OrgID, "uid", f.UID)
		}
		// always expose the dashboard store sequential ID
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
		// nolint:staticcheck
		f.ID = dashFolder.ID

		return nil
	}); err != nil {
		return nil, folder.ErrInternal.Errorf("failed to assign folder sequential ID: %w", err)
	}

	// add "shared with me" folder on the 1st page
	if (q.Page == 0 || q.Page == 1) && len(q.FolderUIDs) != 0 {
		children = append([]*folder.Folder{&folder.SharedWithMeFolder}, children...)
	}

	return children, nil
}

// GetSharedWithMe returns folders available to user, which cannot be accessed from the root folders
func (s *Service) GetSharedWithMe(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.Folder, error) {
	start := time.Now()
	availableNonRootFolders, err := s.getAvailableNonRootFolders(ctx, q)
	if err != nil {
		s.metrics.sharedWithMeFetchFoldersRequestsDuration.WithLabelValues("failure").Observe(time.Since(start).Seconds())
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders to which the user has explicit access: %w", err)
	}
	rootFolders, err := s.GetChildren(ctx, &folder.GetChildrenQuery{UID: "", OrgID: q.OrgID, SignedInUser: q.SignedInUser, Permission: q.Permission})
	if err != nil {
		s.metrics.sharedWithMeFetchFoldersRequestsDuration.WithLabelValues("failure").Observe(time.Since(start).Seconds())
		return nil, folder.ErrInternal.Errorf("failed to fetch root folders to which the user has access: %w", err)
	}

	availableNonRootFolders = s.deduplicateAvailableFolders(ctx, availableNonRootFolders, rootFolders, q.OrgID)
	s.metrics.sharedWithMeFetchFoldersRequestsDuration.WithLabelValues("success").Observe(time.Since(start).Seconds())
	return availableNonRootFolders, nil
}

func (s *Service) getAvailableNonRootFolders(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.Folder, error) {
	permissions := q.SignedInUser.GetPermissions()
	var folderPermissions []string
	if q.Permission == dashboardaccess.PERMISSION_EDIT {
		folderPermissions = permissions[dashboards.ActionFoldersWrite]
		folderPermissions = append(folderPermissions, permissions[dashboards.ActionDashboardsWrite]...)
	} else {
		folderPermissions = permissions[dashboards.ActionFoldersRead]
		folderPermissions = append(folderPermissions, permissions[dashboards.ActionDashboardsRead]...)
	}

	if len(folderPermissions) == 0 {
		return nil, nil
	}

	nonRootFolders := make([]*folder.Folder, 0)
	folderUids := make([]string, 0, len(folderPermissions))
	for _, p := range folderPermissions {
		if folderUid, found := strings.CutPrefix(p, dashboards.ScopeFoldersPrefix); found {
			if !slices.Contains(folderUids, folderUid) {
				folderUids = append(folderUids, folderUid)
			}
		}
	}

	if len(folderUids) == 0 {
		return nonRootFolders, nil
	}

	dashFolders, err := s.GetFolders(ctx, folder.GetFoldersQuery{
		UIDs:             folderUids,
		OrgID:            q.OrgID,
		SignedInUser:     q.SignedInUser,
		OrderByTitle:     true,
		WithFullpathUIDs: true,
	})
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders: %w", err)
	}

	for _, f := range dashFolders {
		if f.ParentUID != "" {
			nonRootFolders = append(nonRootFolders, f)
		}
	}

	return nonRootFolders, nil
}

func (s *Service) deduplicateAvailableFolders(ctx context.Context, folders []*folder.Folder, rootFolders []*folder.Folder, orgID int64) []*folder.Folder {
	allFolders := append(folders, rootFolders...)
	foldersDedup := make([]*folder.Folder, 0)

	for _, f := range folders {
		isSubfolder := slices.ContainsFunc(allFolders, func(folder *folder.Folder) bool {
			return f.ParentUID == folder.UID
		})

		if !isSubfolder {
			// Get parents UIDs
			parentUIDs := make([]string, 0)
			pathUIDs := strings.Split(f.FullpathUIDs, "/")
			for _, p := range pathUIDs {
				if p != "" && p != f.UID {
					parentUIDs = append(parentUIDs, p)
				}
			}

			for _, parentUID := range parentUIDs {
				contains := slices.ContainsFunc(allFolders, func(f *folder.Folder) bool {
					return f.UID == parentUID
				})
				if contains {
					isSubfolder = true
					break
				}
			}
		}

		if !isSubfolder {
			foldersDedup = append(foldersDedup, f)
		}
	}
	return foldersDedup
}

func (s *Service) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	if !s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) || q.UID == accesscontrol.GeneralFolderUID {
		return nil, nil
	}
	if q.UID == folder.SharedWithMeFolderUID {
		return []*folder.Folder{&folder.SharedWithMeFolder}, nil
	}
	return s.store.GetParents(ctx, q)
}

func (s *Service) getFolderByID(ctx context.Context, id int64, orgID int64) (*folder.Folder, error) {
	if id == 0 {
		return &folder.GeneralFolder, nil
	}

	return s.dashboardFolderStore.GetFolderByID(ctx, orgID, id)
}

func (s *Service) getFolderByUID(ctx context.Context, orgID int64, uid string) (*folder.Folder, error) {
	return s.dashboardFolderStore.GetFolderByUID(ctx, orgID, uid)
}

func (s *Service) getFolderByTitle(ctx context.Context, orgID int64, title string, parentUID *string) (*folder.Folder, error) {
	return s.dashboardFolderStore.GetFolderByTitle(ctx, orgID, title, parentUID)
}

func (s *Service) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	if cmd.SignedInUser == nil || cmd.SignedInUser.IsNil() {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	dashFolder := dashboards.NewDashboardFolder(cmd.Title)
	dashFolder.OrgID = cmd.OrgID

	if s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) && cmd.ParentUID != "" {
		// Check that the user is allowed to create a subfolder in this folder
		parentUIDScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(cmd.ParentUID)
		legacyEvaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, parentUIDScope)
		newEvaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersCreate, parentUIDScope)
		evaluator := accesscontrol.EvalAny(legacyEvaluator, newEvaluator)
		hasAccess, evalErr := s.accessControl.Evaluate(ctx, cmd.SignedInUser, evaluator)
		if evalErr != nil {
			return nil, evalErr
		}
		if !hasAccess {
			return nil, dashboards.ErrFolderCreationAccessDenied.Errorf("user is missing the permission with action either folders:create or folders:write and scope %s or any of the parent folder scopes", parentUIDScope)
		}
		dashFolder.FolderUID = cmd.ParentUID
	}

	if cmd.ParentUID == "" {
		evaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID))
		hasAccess, evalErr := s.accessControl.Evaluate(ctx, cmd.SignedInUser, evaluator)
		if evalErr != nil {
			return nil, evalErr
		}
		if !hasAccess {
			return nil, dashboards.ErrFolderCreationAccessDenied.Errorf("user is missing the permission with action folders:create and scope folders:uid:general, which is required to create a folder under the root level")
		}
	}

	if s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) && cmd.UID == folder.SharedWithMeFolderUID {
		return nil, folder.ErrBadRequest.Errorf("cannot create folder with UID %s", folder.SharedWithMeFolderUID)
	}

	trimmedUID := strings.TrimSpace(cmd.UID)
	if trimmedUID == accesscontrol.GeneralFolderUID {
		return nil, dashboards.ErrFolderInvalidUID
	}

	dashFolder.SetUID(trimmedUID)

	user := cmd.SignedInUser

	var userID int64
	if id, err := identity.UserIdentifier(cmd.SignedInUser.GetID()); err == nil {
		userID = id
	} else {
		s.log.Warn("User does not belong to a user or service account namespace, using 0 as user ID", "id", cmd.SignedInUser.GetID())
	}

	if userID == 0 {
		userID = -1
	}

	dashFolder.CreatedBy = userID
	dashFolder.UpdatedBy = userID
	dashFolder.UpdateSlug()

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgID:     cmd.OrgID,
		User:      user,
	}

	saveDashboardCmd, err := s.buildSaveDashboardCommand(ctx, dto)
	if err != nil {
		return nil, toFolderError(err)
	}

	var nestedFolder *folder.Folder
	var dash *dashboards.Dashboard
	err = s.db.InTransaction(ctx, func(ctx context.Context) error {
		if dash, err = s.dashboardStore.SaveDashboard(ctx, *saveDashboardCmd); err != nil {
			return toFolderError(err)
		}

		cmd = &folder.CreateFolderCommand{
			// TODO: Today, if a UID isn't specified, the dashboard store
			// generates a new UID. The new folder store will need to do this as
			// well, but for now we take the UID from the newly created folder.
			UID:         dash.UID,
			OrgID:       cmd.OrgID,
			Title:       dashFolder.Title,
			Description: cmd.Description,
			ParentUID:   cmd.ParentUID,
		}

		if nestedFolder, err = s.nestedFolderCreate(ctx, cmd); err != nil {
			s.log.ErrorContext(ctx, "error saving folder to nested folder store", "error", err)
			return err
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	f := dashboards.FromDashboard(dash)
	if nestedFolder != nil && nestedFolder.ParentUID != "" {
		f.ParentUID = nestedFolder.ParentUID
	}
	if err = s.setDefaultFolderPermissions(ctx, cmd.OrgID, user, f); err != nil {
		return nil, err
	}

	return f, nil
}

func (s *Service) setDefaultFolderPermissions(ctx context.Context, orgID int64, user identity.Requester, folder *folder.Folder) error {
	if !s.cfg.RBAC.PermissionsOnCreation("folder") {
		return nil
	}

	var permissions []accesscontrol.SetResourcePermissionCommand

	if user.IsIdentityType(claims.TypeUser) {
		userID, err := user.GetInternalID()
		if err != nil {
			return err
		}

		permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
			UserID: userID, Permission: dashboardaccess.PERMISSION_ADMIN.String(),
		})
	}

	isNested := folder.ParentUID != ""
	if !isNested || !s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) {
		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
		}...)
	}

	_, err := s.folderPermissions.SetPermissions(ctx, orgID, folder.UID, permissions...)
	return err
}

func (s *Service) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.Update")
	defer span.End()

	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}
	user := cmd.SignedInUser

	var dashFolder, foldr *folder.Folder
	var err error
	err = s.db.InTransaction(ctx, func(ctx context.Context) error {
		if dashFolder, err = s.legacyUpdate(ctx, cmd); err != nil {
			return err
		}

		if foldr, err = s.store.Update(ctx, folder.UpdateFolderCommand{
			UID:            cmd.UID,
			OrgID:          cmd.OrgID,
			NewTitle:       &dashFolder.Title,
			NewDescription: cmd.NewDescription,
			SignedInUser:   user,
		}); err != nil {
			return err
		}

		if cmd.NewTitle != nil {
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()

			if err := s.publishFolderFullPathUpdatedEvent(ctx, foldr.Updated, cmd.OrgID, cmd.UID); err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		s.log.ErrorContext(ctx, "folder update failed", "folderUID", cmd.UID, "error", err)
		return nil, err
	}

	if !s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) {
		return dashFolder, nil
	}

	// always expose the dashboard store sequential ID
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
	// nolint:staticcheck
	foldr.ID = dashFolder.ID
	foldr.Version = dashFolder.Version

	return foldr, nil
}

func (s *Service) legacyUpdate(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	query := dashboards.GetDashboardQuery{OrgID: cmd.OrgID, UID: cmd.UID}
	queryResult, err := s.dashboardStore.GetDashboard(ctx, &query)
	if err != nil {
		return nil, toFolderError(err)
	}

	dashFolder := queryResult
	if cmd.NewParentUID != nil {
		dashFolder.FolderUID = *cmd.NewParentUID
	}

	if !dashFolder.IsFolder {
		return nil, dashboards.ErrFolderNotFound
	}

	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	var userID int64
	if id, err := identity.UserIdentifier(cmd.SignedInUser.GetID()); err == nil {
		userID = id
	} else {
		s.log.Warn("User does not belong to a user or service account namespace, using 0 as user ID", "id", cmd.SignedInUser.GetID())
	}

	prepareForUpdate(dashFolder, cmd.OrgID, userID, cmd)

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgID:     cmd.OrgID,
		User:      cmd.SignedInUser,
		Overwrite: cmd.Overwrite,
	}

	saveDashboardCmd, err := s.buildSaveDashboardCommand(ctx, dto)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := s.dashboardStore.SaveDashboard(ctx, *saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	var foldr *folder.Folder
	foldr, err = s.dashboardFolderStore.GetFolderByID(ctx, cmd.OrgID, dash.ID)
	if err != nil {
		return nil, err
	}

	return foldr, nil
}

// prepareForUpdate updates an existing dashboard model from command into model for folder update
func prepareForUpdate(dashFolder *dashboards.Dashboard, orgId int64, userId int64, cmd *folder.UpdateFolderCommand) {
	dashFolder.OrgID = orgId

	title := dashFolder.Title
	if cmd.NewTitle != nil && *cmd.NewTitle != "" {
		title = *cmd.NewTitle
	}
	dashFolder.Title = strings.TrimSpace(title)
	dashFolder.Data.Set("title", dashFolder.Title)

	dashFolder.SetVersion(cmd.Version)
	dashFolder.IsFolder = true

	if userId == 0 {
		userId = -1
	}

	dashFolder.UpdatedBy = userId
	dashFolder.UpdateSlug()
}

func (s *Service) Delete(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	if cmd.SignedInUser == nil {
		return folder.ErrBadRequest.Errorf("missing signed in user")
	}
	if cmd.UID == "" {
		return folder.ErrBadRequest.Errorf("missing UID")
	}
	if cmd.OrgID < 1 {
		return folder.ErrBadRequest.Errorf("invalid orgID")
	}

	guard, err := guardian.NewByUID(ctx, cmd.UID, cmd.OrgID, cmd.SignedInUser)
	if err != nil {
		return err
	}

	if canSave, err := guard.CanDelete(); err != nil || !canSave {
		if err != nil {
			return toFolderError(err)
		}
		return dashboards.ErrFolderAccessDenied
	}

	folders := []string{cmd.UID}
	err = s.db.InTransaction(ctx, func(ctx context.Context) error {
		descendants, err := s.nestedFolderDelete(ctx, cmd)

		if err != nil {
			s.log.ErrorContext(ctx, "the delete folder on folder table failed with err: ", "error", err)
			return err
		}
		folders = append(folders, descendants...)

		if cmd.ForceDeleteRules {
			if err := s.deleteChildrenInFolder(ctx, cmd.OrgID, folders, cmd.SignedInUser); err != nil {
				return err
			}
		} else {
			alertRuleSrv, ok := s.registry[entity.StandardKindAlertRule]
			if !ok {
				return folder.ErrInternal.Errorf("no alert rule service found in registry")
			}
			alertRulesInFolder, err := alertRuleSrv.CountInFolders(ctx, cmd.OrgID, folders, cmd.SignedInUser)
			if err != nil {
				s.log.Error("failed to count alert rules in folder", "error", err)
				return err
			}
			if alertRulesInFolder > 0 {
				return folder.ErrFolderNotEmpty.Errorf("folder contains %d alert rules", alertRulesInFolder)
			}
		}

		if err = s.legacyDelete(ctx, cmd, folders); err != nil {
			return err
		}

		return nil
	})

	return err
}

func (s *Service) deleteChildrenInFolder(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error {
	for _, v := range s.registry {
		if err := v.DeleteInFolders(ctx, orgID, folderUIDs, user); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) legacyDelete(ctx context.Context, cmd *folder.DeleteFolderCommand, folderUIDs []string) error {
	// TODO use bulk delete
	for _, folderUID := range folderUIDs {
		// nolint:staticcheck
		deleteCmd := dashboards.DeleteDashboardCommand{OrgID: cmd.OrgID, UID: folderUID, ForceDeleteFolderRules: cmd.ForceDeleteRules}
		if err := s.dashboardStore.DeleteDashboard(ctx, &deleteCmd); err != nil {
			return toFolderError(err)
		}
	}
	return nil
}

func (s *Service) Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.Move")
	defer span.End()

	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	// k6-specific check to prevent folder move for a k6-app folder and its children
	if cmd.UID == accesscontrol.K6FolderUID {
		return nil, folder.ErrBadRequest.Errorf("k6 project may not be moved")
	}
	if f, err := s.store.Get(ctx, folder.GetFolderQuery{UID: &cmd.UID, OrgID: cmd.OrgID}); err != nil {
		return nil, err
	} else if f != nil && f.ParentUID == accesscontrol.K6FolderUID {
		return nil, folder.ErrBadRequest.Errorf("k6 project may not be moved")
	}

	// Check that the user is allowed to move the folder to the destination folder
	hasAccess, evalErr := s.canMove(ctx, cmd)
	if evalErr != nil {
		return nil, evalErr
	}
	if !hasAccess {
		return nil, dashboards.ErrFolderAccessDenied
	}

	// here we get the folder, we need to get the height of current folder
	// and the depth of the new parent folder, the sum can't bypass 8
	folderHeight, err := s.store.GetHeight(ctx, cmd.UID, cmd.OrgID, &cmd.NewParentUID)
	if err != nil {
		return nil, err
	}
	parents, err := s.store.GetParents(ctx, folder.GetParentsQuery{UID: cmd.NewParentUID, OrgID: cmd.OrgID})
	if err != nil {
		return nil, err
	}

	// height of the folder that is being moved + this current folder itself + depth of the NewParent folder should be less than or equal MaxNestedFolderDepth
	if folderHeight+len(parents)+1 > folder.MaxNestedFolderDepth {
		return nil, folder.ErrMaximumDepthReached.Errorf("failed to move folder")
	}

	for _, parent := range parents {
		// if the current folder is already a parent of newparent, we should return error
		if parent.UID == cmd.UID {
			return nil, folder.ErrCircularReference.Errorf("failed to move folder")
		}
	}

	var f *folder.Folder
	if err := s.db.InTransaction(ctx, func(ctx context.Context) error {
		if f, err = s.store.Update(ctx, folder.UpdateFolderCommand{
			UID:          cmd.UID,
			OrgID:        cmd.OrgID,
			NewParentUID: &cmd.NewParentUID,
			SignedInUser: cmd.SignedInUser,
		}); err != nil {
			if s.db.GetDialect().IsUniqueConstraintViolation(err) {
				return folder.ErrConflict.Errorf("%w", dashboards.ErrFolderSameNameExists)
			}
			return folder.ErrInternal.Errorf("failed to move folder: %w", err)
		}

		if _, err := s.legacyUpdate(ctx, &folder.UpdateFolderCommand{
			UID:          cmd.UID,
			OrgID:        cmd.OrgID,
			NewParentUID: &cmd.NewParentUID,
			SignedInUser: cmd.SignedInUser,
			// bypass optimistic locking used for dashboards
			Overwrite: true,
		}); err != nil {
			if s.db.GetDialect().IsUniqueConstraintViolation(err) {
				return folder.ErrConflict.Errorf("%w", dashboards.ErrFolderSameNameExists)
			}
			return folder.ErrInternal.Errorf("failed to move legacy folder: %w", err)
		}

		if err := s.publishFolderFullPathUpdatedEvent(ctx, f.Updated, cmd.OrgID, cmd.UID); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *Service) publishFolderFullPathUpdatedEvent(ctx context.Context, timestamp time.Time, orgID int64, folderUID string) error {
	ctx, span := s.tracer.Start(ctx, "folder.publishFolderFullPathUpdatedEvent")
	defer span.End()

	descFolders, err := s.store.GetDescendants(ctx, orgID, folderUID)
	if err != nil {
		s.log.ErrorContext(ctx, "Failed to get descendants of the folder", "folderUID", folderUID, "orgID", orgID, "error", err)
		return err
	}
	uids := make([]string, 0, len(descFolders)+1)
	uids = append(uids, folderUID)
	for _, f := range descFolders {
		uids = append(uids, f.UID)
	}
	span.AddEvent("found folder descendants", trace.WithAttributes(
		attribute.Int64("folders", int64(len(uids))),
	))

	if err := s.bus.Publish(ctx, &events.FolderFullPathUpdated{
		Timestamp: timestamp,
		UIDs:      uids,
		OrgID:     orgID,
	}); err != nil {
		s.log.ErrorContext(ctx, "Failed to publish FolderFullPathUpdated event", "folderUID", folderUID, "orgID", orgID, "descendantsUIDs", uids, "error", err)
		return err
	}

	return nil
}

func (s *Service) canMove(ctx context.Context, cmd *folder.MoveFolderCommand) (bool, error) {
	// Check that the user is allowed to move the folder to the destination folder
	var evaluator accesscontrol.Evaluator
	parentUID := cmd.NewParentUID
	if parentUID != "" {
		legacyEvaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(cmd.NewParentUID))
		newEvaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(cmd.NewParentUID))
		evaluator = accesscontrol.EvalAny(legacyEvaluator, newEvaluator)
	} else {
		// Evaluate folder creation permission when moving folder to the root level
		evaluator = accesscontrol.EvalPermission(dashboards.ActionFoldersCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID))
		parentUID = folder.GeneralFolderUID
	}
	if hasAccess, err := s.accessControl.Evaluate(ctx, cmd.SignedInUser, evaluator); err != nil {
		return false, err
	} else if !hasAccess {
		return false, dashboards.ErrMoveAccessDenied.Errorf("user does not have permissions to move a folder to folder with UID %s", parentUID)
	}

	// Check that the user would not be elevating their permissions by moving a folder to the destination folder
	// This is needed for plugins, as different folders can have different plugin configs
	// We do this by checking that there are no permissions that user has on the destination parent folder but not on the source folder
	// We also need to look at the folder tree for the destination folder, as folder permissions are inherited
	newFolderAndParentUIDs, err := s.getFolderAndParentUIDScopes(ctx, parentUID, cmd.OrgID)
	if err != nil {
		return false, err
	}

	permissions := cmd.SignedInUser.GetPermissions()
	var evaluators []accesscontrol.Evaluator
	currentFolderScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(cmd.UID)
	for action, scopes := range permissions {
		// Skip unexpanded action sets - they have no impact if action sets are not enabled
		if !s.features.IsEnabled(ctx, featuremgmt.FlagAccessActionSets) {
			if action == "folders:view" || action == "folders:edit" || action == "folders:admin" {
				continue
			}
		}
		for _, scope := range newFolderAndParentUIDs {
			if slices.Contains(scopes, scope) {
				evaluators = append(evaluators, accesscontrol.EvalPermission(action, currentFolderScope))
				break
			}
		}
	}

	if hasAccess, err := s.accessControl.Evaluate(ctx, cmd.SignedInUser, accesscontrol.EvalAll(evaluators...)); err != nil {
		return false, err
	} else if !hasAccess {
		return false, dashboards.ErrFolderAccessEscalation.Errorf("user cannot move a folder to another folder where they have higher permissions")
	}
	return true, nil
}

func (s *Service) getFolderAndParentUIDScopes(ctx context.Context, folderUID string, orgID int64) ([]string, error) {
	folderAndParentUIDScopes := []string{dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}
	if folderUID == folder.GeneralFolderUID {
		return folderAndParentUIDScopes, nil
	}
	folderParents, err := s.store.GetParents(ctx, folder.GetParentsQuery{UID: folderUID, OrgID: orgID})
	if err != nil {
		return nil, err
	}
	for _, newParent := range folderParents {
		scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(newParent.UID)
		folderAndParentUIDScopes = append(folderAndParentUIDScopes, scope)
	}
	return folderAndParentUIDScopes, nil
}

// nestedFolderDelete inspects the folder referenced by the cmd argument, deletes all the entries for
// its descendant folders (folders which are nested within it either directly or indirectly) from
// the folder store and returns the UIDs for all its descendants.
func (s *Service) nestedFolderDelete(ctx context.Context, cmd *folder.DeleteFolderCommand) ([]string, error) {
	descendantUIDs := []string{}
	if cmd.SignedInUser == nil {
		return descendantUIDs, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	_, err := s.Get(ctx, &folder.GetFolderQuery{
		UID:          &cmd.UID,
		OrgID:        cmd.OrgID,
		SignedInUser: cmd.SignedInUser,
	})
	if err != nil {
		return descendantUIDs, err
	}

	descendants, err := s.store.GetDescendants(ctx, cmd.OrgID, cmd.UID)
	if err != nil {
		s.log.ErrorContext(ctx, "failed to get descendant folders", "error", err)
		return descendantUIDs, err
	}

	for _, f := range descendants {
		descendantUIDs = append(descendantUIDs, f.UID)
	}
	s.log.InfoContext(ctx, "deleting folder and its descendants", "org_id", cmd.OrgID, "uid", cmd.UID)
	toDelete := append(descendantUIDs, cmd.UID)
	err = s.store.Delete(ctx, toDelete, cmd.OrgID)
	if err != nil {
		s.log.InfoContext(ctx, "failed deleting folder", "org_id", cmd.OrgID, "uid", cmd.UID, "err", err)
		return descendantUIDs, err
	}
	return descendantUIDs, nil
}

func (s *Service) GetDescendantCounts(ctx context.Context, q *folder.GetDescendantCountsQuery) (folder.DescendantCounts, error) {
	if q.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed-in user")
	}
	if q.UID == nil || *q.UID == "" {
		return nil, folder.ErrBadRequest.Errorf("missing UID")
	}
	if q.OrgID < 1 {
		return nil, folder.ErrBadRequest.Errorf("invalid orgID")
	}

	folders := []string{*q.UID}
	countsMap := make(folder.DescendantCounts, len(s.registry)+1)
	if s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) {
		descendantFolders, err := s.store.GetDescendants(ctx, q.OrgID, *q.UID)
		if err != nil {
			s.log.ErrorContext(ctx, "failed to get descendant folders", "error", err)
			return nil, err
		}
		for _, f := range descendantFolders {
			folders = append(folders, f.UID)
		}
		countsMap[entity.StandardKindFolder] = int64(len(descendantFolders))
	}

	for _, v := range s.registry {
		c, err := v.CountInFolders(ctx, q.OrgID, folders, q.SignedInUser)
		if err != nil {
			s.log.ErrorContext(ctx, "failed to count folder descendants", "error", err)
			return nil, err
		}
		countsMap[v.Kind()] = c
	}
	return countsMap, nil
}

// buildSaveDashboardCommand is a simplified version on DashboardServiceImpl.buildSaveDashboardCommand
// keeping only the meaningful functionality for folders
func (s *Service) buildSaveDashboardCommand(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*dashboards.SaveDashboardCommand, error) {
	dash := dto.Dashboard

	dash.OrgID = dto.OrgID
	dash.Title = strings.TrimSpace(dash.Title)
	dash.Data.Set("title", dash.Title)
	dash.SetUID(strings.TrimSpace(dash.UID))

	if dash.Title == "" {
		return nil, dashboards.ErrDashboardTitleEmpty
	}

	if strings.EqualFold(dash.Title, dashboards.RootFolderName) {
		return nil, dashboards.ErrDashboardFolderNameExists
	}

	if dash.FolderUID != "" {
		if _, err := s.dashboardFolderStore.GetFolderByUID(ctx, dash.OrgID, dash.FolderUID); err != nil {
			return nil, err
		}
	}

	if !util.IsValidShortUID(dash.UID) {
		return nil, dashboards.ErrDashboardInvalidUid
	} else if util.IsShortUIDTooLong(dash.UID) {
		return nil, dashboards.ErrDashboardUidTooLong
	}

	_, err := s.dashboardStore.ValidateDashboardBeforeSave(ctx, dash, dto.Overwrite)
	if err != nil {
		return nil, err
	}

	guard, err := getGuardianForSavePermissionCheck(ctx, dash, dto.User)
	if err != nil {
		return nil, err
	}

	if dash.ID == 0 {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
		// nolint:staticcheck
		if canCreate, err := guard.CanCreate(dash.FolderID, dash.IsFolder); err != nil || !canCreate {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	} else {
		if canSave, err := guard.CanSave(); err != nil || !canSave {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	}

	var userID int64
	if id, err := identity.UserIdentifier(dto.User.GetID()); err == nil {
		userID = id
	} else {
		s.log.Warn("User does not belong to a user or service account namespace, using 0 as user ID", "id", dto.User.GetID())
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
	cmd := &dashboards.SaveDashboardCommand{
		Dashboard: dash.Data,
		Message:   dto.Message,
		OrgID:     dto.OrgID,
		Overwrite: dto.Overwrite,
		UserID:    userID,
		FolderID:  dash.FolderID, // nolint:staticcheck
		FolderUID: dash.FolderUID,
		IsFolder:  dash.IsFolder,
		PluginID:  dash.PluginID,
	}

	if !dto.UpdatedAt.IsZero() {
		cmd.UpdatedAt = dto.UpdatedAt
	}

	return cmd, nil
}

// SplitFullpath splits a string into an array of strings using the FULLPATH_SEPARATOR as the delimiter.
// It handles escape characters by appending the separator and the new string if the current string ends with an escape character.
// The resulting array does not contain empty strings.
func SplitFullpath(s string) []string {
	splitStrings := strings.Split(s, FULLPATH_SEPARATOR)

	result := make([]string, 0)
	current := ""

	for _, str := range splitStrings {
		if strings.HasSuffix(current, "\\") {
			// If the current string ends with an escape character, append the separator and the new string
			current = current[:len(current)-1] + FULLPATH_SEPARATOR + str
		} else {
			// If the current string does not end with an escape character, append the current string to the result and start a new current string
			if current != "" {
				result = append(result, current)
			}
			current = str
		}
	}

	// Append the last string to the result
	if current != "" {
		result = append(result, current)
	}

	return result
}

// getGuardianForSavePermissionCheck returns the guardian to be used for checking permission of dashboard
// It replaces deleted Dashboard.GetDashboardIdForSavePermissionCheck()
func getGuardianForSavePermissionCheck(ctx context.Context, d *dashboards.Dashboard, user identity.Requester) (guardian.DashboardGuardian, error) {
	newDashboard := d.ID == 0

	if newDashboard {
		// if it's a new dashboard/folder check the parent folder permissions
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
		// nolint:staticcheck
		guard, err := guardian.New(ctx, d.FolderID, d.OrgID, user)
		if err != nil {
			return nil, err
		}
		return guard, nil
	}
	guard, err := guardian.NewByDashboard(ctx, d, d.OrgID, user)
	if err != nil {
		return nil, err
	}
	return guard, nil
}

func (s *Service) nestedFolderCreate(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	if cmd.ParentUID != "" {
		if err := s.validateParent(ctx, cmd.OrgID, cmd.ParentUID, cmd.UID); err != nil {
			return nil, err
		}
	}
	return s.store.Create(ctx, *cmd)
}

func (s *Service) validateParent(ctx context.Context, orgID int64, parentUID string, UID string) error {
	ancestors, err := s.store.GetParents(ctx, folder.GetParentsQuery{UID: parentUID, OrgID: orgID})
	if err != nil {
		return fmt.Errorf("failed to get parents: %w", err)
	}

	if len(ancestors) >= folder.MaxNestedFolderDepth {
		return folder.ErrMaximumDepthReached.Errorf("failed to validate parent folder")
	}

	// Create folder under itself is not allowed
	if parentUID == UID {
		return folder.ErrCircularReference
	}

	// check there is no circular reference
	for _, ancestor := range ancestors {
		if ancestor.UID == UID {
			return folder.ErrCircularReference
		}
	}

	return nil
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

	return err
}

func (s *Service) RegisterService(r folder.RegistryService) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.registry[r.Kind()] = r

	return nil
}

func (s *Service) supportBundleCollector() supportbundles.Collector {
	collector := supportbundles.Collector{
		UID:               "folder-stats",
		DisplayName:       "Folder information",
		Description:       "Folder information for the Grafana instance",
		IncludedByDefault: false,
		Default:           true,
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
			s.log.Info("Generating folder support bundle")
			folders, err := s.GetFolders(ctx, folder.GetFoldersQuery{
				OrgID: 0,
				SignedInUser: &user.SignedInUser{
					Login:            "sa-supportbundle",
					OrgRole:          "Admin",
					IsGrafanaAdmin:   true,
					IsServiceAccount: true,
					Permissions:      map[int64]map[string][]string{accesscontrol.GlobalOrgID: {dashboards.ActionFoldersRead: {dashboards.ScopeFoldersAll}}},
				},
			})
			if err != nil {
				return nil, err
			}
			return s.supportItemFromFolders(folders)
		},
	}
	return collector
}

func (s *Service) supportItemFromFolders(folders []*folder.Folder) (*supportbundles.SupportItem, error) {
	stats := struct {
		Total    int              `json:"total"`    // how many folders?
		Depths   map[int]int      `json:"depths"`   // how deep they are?
		Children map[int]int      `json:"children"` // how many child folders they have?
		Folders  []*folder.Folder `json:"folders"`  // what are they?
	}{Total: len(folders), Folders: folders, Children: map[int]int{}, Depths: map[int]int{}}

	// Build parent-child mapping
	parents := map[string]string{}
	children := map[string][]string{}
	for _, f := range folders {
		parents[f.UID] = f.ParentUID
		children[f.ParentUID] = append(children[f.ParentUID], f.UID)
	}
	// Find depths of each folder
	for _, f := range folders {
		depth := 0
		for uid := f.UID; uid != ""; uid = parents[uid] {
			depth++
		}
		stats.Depths[depth] += 1
		stats.Children[len(children[f.UID])] += 1
	}

	b, err := json.MarshalIndent(stats, "", " ")
	if err != nil {
		return nil, err
	}
	return &supportbundles.SupportItem{
		Filename:  "folders.json",
		FileBytes: b,
	}, nil
}
