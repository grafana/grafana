package folderimpl

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util"
)

const folderSearchLimit = 100000
const folderListLimit = 100000
const FULLPATH_SEPARATOR = "/"

var (
	_ folder.Service = (*Service)(nil)
)

type Service struct {
	log                    *slog.Logger
	userService            user.Service
	features               featuremgmt.FeatureToggles
	accessControl          accesscontrol.AccessControl
	k8sclient              client.K8sHandler
	maxNestedFolderDepth   int
	dashboardK8sClient     client.K8sHandler
	publicDashboardService publicdashboards.ServiceWrapper
	// bus is currently used to publish event in case of folder full path change.
	// For example when a folder is moved to another folder or when a folder is renamed.
	bus bus.Bus

	mutex    sync.RWMutex
	registry map[string]folder.RegistryService
	metrics  *foldersMetrics
	tracer   trace.Tracer
}

func ProvideService(
	ac accesscontrol.AccessControl,
	bus bus.Bus,
	userService user.Service,
	features featuremgmt.FeatureToggles,
	supportBundles supportbundles.Service,
	publicDashboardService publicdashboards.ServiceWrapper,
	cfg *setting.Cfg,
	r prometheus.Registerer,
	tracer trace.Tracer,
	resourceClient resource.ResourceClient,
	dual dualwrite.Service,
	sorter sort.Service,
	restConfig apiserver.RestConfigProvider,
) *Service {
	srv := &Service{
		log:                    slog.Default().With("logger", "folder-service"),
		features:               features,
		userService:            userService,
		accessControl:          ac,
		bus:                    bus,
		registry:               make(map[string]folder.RegistryService),
		metrics:                newFoldersMetrics(r),
		tracer:                 tracer,
		publicDashboardService: publicDashboardService,
		maxNestedFolderDepth:   cfg.MaxNestedFolderDepth,
	}

	supportBundles.RegisterSupportItemCollector(srv.supportBundleCollector())

	ac.RegisterScopeAttributeResolver(dashboards.NewFolderIDScopeResolver(srv.getUIDFromLegacyID, srv))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderUIDScopeResolver(srv))

	k8sHandler := client.NewK8sHandler(
		dual,
		request.GetNamespaceMapper(cfg),
		folderv1.FolderResourceInfo.GroupVersionResource(),
		restConfig.GetRestConfig,
		nil,
		userService,
		resourceClient,
		sorter,
		features,
	)

	srv.k8sclient = k8sHandler

	dashHandler := client.NewK8sHandler(
		dual,
		request.GetNamespaceMapper(cfg),
		dashboardv1.DashboardResourceInfo.GroupVersionResource(),
		restConfig.GetRestConfig,
		nil,
		userService,
		resourceClient,
		sorter,
		features,
	)
	srv.dashboardK8sClient = dashHandler

	return srv
}

func (s *Service) CountFoldersInOrg(ctx context.Context, orgID int64) (int64, error) {
	ctx, span := s.tracer.Start(ctx, "folder.CountFoldersInOrg")
	defer span.End()

	resp, err := s.k8sclient.GetStats(ctx, orgID)
	if err != nil {
		return 0, err
	}

	if len(resp.Stats) != 1 {
		return 0, fmt.Errorf("expected 1 stat, got %d", len(resp.Stats))
	}

	return resp.Stats[0].Count, nil
}

func (s *Service) SearchFolders(ctx context.Context, q folder.SearchFoldersQuery) (model.HitList, error) {
	ctx, span := s.tracer.Start(ctx, "folder.SearchFolders")
	defer span.End()
	// TODO:
	// - implement filtering by alerting folders and k6 folders (see the dashboards store `FindDashboards` method for reference)
	// - implement fallback on search client in unistore to go to legacy store (will need to read from dashboard store)

	if q.OrgID == 0 {
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}
		q.OrgID = requester.GetOrgID()
	}

	request := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: s.k8sclient.GetNamespace(q.OrgID),
				Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
				Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
			},
			Fields: []*resourcepb.Requirement{},
			Labels: []*resourcepb.Requirement{},
		},
		Limit: folderSearchLimit}

	if len(q.UIDs) > 0 {
		request.Options.Fields = []*resourcepb.Requirement{{
			Key:      resource.SEARCH_FIELD_NAME,
			Operator: string(selection.In),
			Values:   q.UIDs,
		}}
	} else if len(q.IDs) > 0 {
		values := make([]string, len(q.IDs))
		for i, id := range q.IDs {
			values[i] = strconv.FormatInt(id, 10)
		}

		request.Options.Labels = append(request.Options.Labels, &resourcepb.Requirement{
			Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
			Operator: string(selection.In),
			Values:   values,
		})
	}

	if q.Title != "" {
		// allow wildcard search
		request.Query = "*" + strings.ToLower(q.Title) + "*"
		// or perform exact match if requested
		if q.TitleExactMatch {
			request.Query = q.Title
		}

		// if using query, you need to specify the fields you want
		request.Fields = dashboardsearch.IncludeFields
	}

	if q.Limit > 0 {
		request.Limit = q.Limit
	}

	res, err := s.k8sclient.Search(ctx, q.OrgID, request)
	if err != nil {
		return nil, err
	}

	parsedResults, err := dashboardsearch.ParseResults(res, 0)
	if err != nil {
		return nil, err
	}

	hitList := make([]*model.Hit, len(parsedResults.Hits))
	for i, item := range parsedResults.Hits {
		slug := slugify.Slugify(item.Title)
		hitList[i] = &model.Hit{
			ID:          item.Field.GetNestedInt64(resource.SEARCH_FIELD_LEGACY_ID),
			UID:         item.Name,
			OrgID:       q.OrgID,
			Title:       item.Title,
			URI:         "db/" + slug,
			URL:         dashboards.GetFolderURL(item.Name, slug),
			Type:        model.DashHitFolder,
			FolderUID:   item.Folder,
			Description: item.Description,
		}
	}

	return hitList, nil
}

func (s *Service) GetFolders(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.GetFolders")
	defer span.End()

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

	var dashFolders []*folder.Folder
	var err error

	ctx = identity.WithRequester(ctx, q.SignedInUser)
	dashFolders, err = s.getFoldersViaK8s(ctx, qry)
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders: %w", err)
	}

	return dashFolders, nil
}

func (s *Service) Get(ctx context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.Get")
	defer span.End()

	if q.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	if q.UID != nil && *q.UID == accesscontrol.GeneralFolderUID {
		return folder.RootFolder, nil
	}

	if q.UID != nil && *q.UID == folder.SharedWithMeFolderUID {
		return folder.SharedWithMeFolder.WithURL(), nil
	}

	ctx = identity.WithRequester(ctx, q.SignedInUser)

	var dashFolder *folder.Folder
	var err error
	switch {
	case q.UID != nil && *q.UID != "":
		dashFolder, err = s.getViaK8s(ctx, *q)
		if err != nil {
			return nil, toFolderError(err)
		}
	// nolint:staticcheck
	case q.ID != nil && *q.ID != 0:
		dashFolder, err = s.getFolderByID(ctx, *q.ID, q.OrgID)
		if err != nil {
			return nil, toFolderError(err)
		}
	case q.Title != nil && *q.Title != "":
		dashFolder, err = s.getFolderByTitle(ctx, q.OrgID, *q.Title, q.ParentUID)
		if err != nil {
			return nil, toFolderError(err)
		}
	default:
		return &folder.GeneralFolder, nil
	}

	if dashFolder.IsGeneral() {
		return dashFolder, nil
	}

	evaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(dashFolder.UID))
	if canView, err := s.accessControl.Evaluate(ctx, q.SignedInUser, evaluator); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
	// nolint:staticcheck
	if q.ID != nil {
		q.ID = nil
		q.UID = &dashFolder.UID
	}

	f := dashFolder

	// always expose the dashboard store sequential ID
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()
	// nolint:staticcheck
	f.ID = dashFolder.ID
	f.Version = dashFolder.Version

	if q.WithFullpath || q.WithFullpathUIDs {
		f, err = s.setFullpath(ctx, f, false)
		if err != nil {
			return nil, err
		}
	}

	return f, err
}

func (s *Service) setFullpath(ctx context.Context, f *folder.Folder, forceLegacy bool) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.setFullpath")
	defer span.End()

	if f.ParentUID == "" {
		return f, nil
	}

	// Fetch the parent since the permissions for fetching the newly created folder
	// are not yet present for the user--this requires a call to ClearUserPermissionCache
	parents, err := s.GetParents(ctx, folder.GetParentsQuery{
		UID:   f.UID,
		OrgID: f.OrgID,
	})
	if err != nil {
		return nil, err
	}
	// #TODO revisit setting permissions so that we can centralise the logic for escaping slashes in titles
	// Escape forward slashes in the title
	f.Fullpath, f.FullpathUIDs = computeFullPath(append(parents, f))
	return f, nil
}

func (s *Service) GetChildren(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	ctx, span := s.tracer.Start(ctx, "folder.GetChildren")
	defer span.End()
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

	if q.UID == folder.SharedWithMeFolderUID {
		return s.GetSharedWithMe(ctx, q, false)
	}

	if q.UID == "" {
		return s.getRootFolders(ctx, q)
	}

	// we only need to check access to the folder
	// if the parent is accessible then the subfolders are accessible as well (due to inheritance)
	evaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(q.UID))
	if q.Permission == dashboardaccess.PERMISSION_EDIT {
		evaluator = accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(q.UID))
	}
	if hasAccess, err := s.accessControl.Evaluate(ctx, q.SignedInUser, evaluator); err != nil || !hasAccess {
		if err != nil {
			return nil, err
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	children, err := s.getChildrenViaK8s(ctx, *q)
	if err != nil {
		return nil, err
	}

	return children, nil
}

// GetSharedWithMe returns folders available to user, which cannot be accessed from the root folders
func (s *Service) GetSharedWithMe(ctx context.Context, q *folder.GetChildrenQuery, forceLegacy bool) ([]*folder.FolderReference, error) {
	ctx, span := s.tracer.Start(ctx, "folder.GetSharedWithMe")
	defer span.End()
	start := time.Now()
	availableNonRootFolders, err := s.getAvailableNonRootFolders(ctx, q, forceLegacy)
	if err != nil {
		s.metrics.sharedWithMeFetchFoldersRequestsDuration.WithLabelValues("failure").Observe(time.Since(start).Seconds())
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders to which the user has explicit access: %w", err)
	}
	rootFolders, err := s.GetChildren(ctx, &folder.GetChildrenQuery{UID: "", OrgID: q.OrgID, SignedInUser: q.SignedInUser, Permission: q.Permission})
	if err != nil {
		s.metrics.sharedWithMeFetchFoldersRequestsDuration.WithLabelValues("failure").Observe(time.Since(start).Seconds())
		return nil, folder.ErrInternal.Errorf("failed to fetch root folders to which the user has access: %w", err)
	}

	dedupAvailableNonRootFolders := s.deduplicateAvailableFolders(ctx, availableNonRootFolders, rootFolders)
	s.metrics.sharedWithMeFetchFoldersRequestsDuration.WithLabelValues("success").Observe(time.Since(start).Seconds())
	return dedupAvailableNonRootFolders, nil
}

func (s *Service) getAvailableNonRootFolders(ctx context.Context, q *folder.GetChildrenQuery, forceLegacy bool) ([]*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getAvailableNonRootFolders")
	defer span.End()
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

func (s *Service) deduplicateAvailableFolders(ctx context.Context, folders []*folder.Folder, rootFolders []*folder.FolderReference) []*folder.FolderReference {
	foldersRef := make([]*folder.FolderReference, len(folders))
	for i, f := range folders {
		foldersRef[i] = f.ToFolderReference()
	}

	_, span := s.tracer.Start(ctx, "folder.deduplicateAvailableFolders")
	defer span.End()
	allFolders := append(foldersRef, rootFolders...)
	foldersDedup := make([]*folder.FolderReference, 0)

	for _, f := range folders {
		isSubfolder := slices.ContainsFunc(allFolders, func(folder *folder.FolderReference) bool {
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
				contains := slices.ContainsFunc(allFolders, func(f *folder.FolderReference) bool {
					return f.UID == parentUID
				})
				if contains {
					isSubfolder = true
					break
				}
			}
		}

		if !isSubfolder {
			foldersDedup = append(foldersDedup, f.ToFolderReference())
		}
	}
	return foldersDedup
}

func (s *Service) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.GetParents")
	defer span.End()

	if q.UID == accesscontrol.GeneralFolderUID {
		return nil, nil
	}
	if q.UID == folder.SharedWithMeFolderUID {
		return []*folder.Folder{&folder.SharedWithMeFolder}, nil
	}

	return s.getParentsViaK8s(ctx, q)
}

func (s *Service) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.createOnApiServer")
	defer span.End()

	if cmd.SignedInUser == nil || cmd.SignedInUser.IsNil() {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	if cmd.ParentUID != "" {
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
	} else {
		evaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID))
		hasAccess, evalErr := s.accessControl.Evaluate(ctx, cmd.SignedInUser, evaluator)
		if evalErr != nil {
			return nil, evalErr
		}
		if !hasAccess {
			return nil, dashboards.ErrFolderCreationAccessDenied.Errorf("user is missing the permission with action folders:create and scope folders:uid:general, which is required to create a folder under the root level")
		}
	}

	if cmd.UID == folder.SharedWithMeFolderUID {
		return nil, folder.ErrBadRequest.Errorf("cannot create folder with UID %s", folder.SharedWithMeFolderUID)
	}

	trimmedUID := strings.TrimSpace(cmd.UID)
	if trimmedUID == accesscontrol.GeneralFolderUID {
		return nil, dashboards.ErrFolderInvalidUID
	}

	cmd = &folder.CreateFolderCommand{
		UID:          trimmedUID,
		OrgID:        cmd.OrgID,
		Title:        cmd.Title,
		Description:  cmd.Description,
		ParentUID:    cmd.ParentUID,
		SignedInUser: cmd.SignedInUser,
		// pass along provisioning details
		ManagerKindClassicFP: cmd.ManagerKindClassicFP, // nolint:staticcheck
	}

	f, err := s.createViaK8s(ctx, *cmd)
	if err != nil {
		return nil, err
	}

	return f, nil
}

func (s *Service) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.Update")
	defer span.End()

	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	if cmd.NewTitle != nil && *cmd.NewTitle != "" {
		title := strings.TrimSpace(*cmd.NewTitle)
		cmd.NewTitle = &title

		if strings.EqualFold(*cmd.NewTitle, dashboards.RootFolderName) {
			return nil, dashboards.ErrDashboardFolderNameExists
		}
	}

	if !util.IsValidShortUID(cmd.UID) {
		return nil, dashboards.ErrDashboardInvalidUid
	} else if util.IsShortUIDTooLong(cmd.UID) {
		return nil, dashboards.ErrDashboardUidTooLong
	}

	cmd.UID = strings.TrimSpace(cmd.UID)

	if cmd.NewTitle != nil && *cmd.NewTitle == "" {
		return nil, dashboards.ErrDashboardTitleEmpty
	}

	evaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(cmd.UID))
	if hasAccess, err := s.accessControl.Evaluate(ctx, cmd.SignedInUser, evaluator); err != nil || !hasAccess {
		if err != nil {
			return nil, err
		}
		return nil, toFolderError(dashboards.ErrDashboardUpdateAccessDenied)
	}

	user := cmd.SignedInUser

	folder, err := s.updateViaK8s(ctx, folder.UpdateFolderCommand{
		UID:                  cmd.UID,
		OrgID:                cmd.OrgID,
		NewTitle:             cmd.NewTitle,
		NewDescription:       cmd.NewDescription,
		SignedInUser:         user,
		Overwrite:            cmd.Overwrite,
		Version:              cmd.Version,
		ManagerKindClassicFP: cmd.ManagerKindClassicFP, // nolint:staticcheck
	})

	if err != nil {
		return nil, err
	}

	if cmd.NewTitle != nil {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()

		if err := s.publishFolderFullPathUpdatedEvent(ctx, folder.Updated, cmd.OrgID, cmd.UID); err != nil {
			return nil, err
		}
	}

	// always expose the dashboard store sequential ID
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()

	return folder, nil
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
	ctx, span := s.tracer.Start(ctx, "folder.Delete")
	defer span.End()

	if cmd.SignedInUser == nil {
		return folder.ErrBadRequest.Errorf("missing signed in user")
	}
	if cmd.UID == "" {
		return folder.ErrBadRequest.Errorf("missing UID")
	}
	if cmd.OrgID < 1 {
		return folder.ErrBadRequest.Errorf("invalid orgID")
	}

	evaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(cmd.UID))
	if hasAccess, err := s.accessControl.Evaluate(ctx, cmd.SignedInUser, evaluator); err != nil || !hasAccess {
		if err != nil {
			return toFolderError(err)
		}
		return dashboards.ErrFolderAccessDenied
	}

	descFolders, err := s.getDescendantsViaK8s(ctx, cmd.OrgID, cmd.UID)
	if err != nil {
		return err
	}
	descFolders = folder.SortByPostorder(descFolders)

	folders := []string{}
	for _, f := range descFolders {
		folders = append(folders, f.UID)
	}
	// must delete children first, then the parent folder
	s.log.InfoContext(ctx, "deleting folder with descendants", "org_id", cmd.OrgID, "uid", cmd.UID, "folderUIDs", strings.Join(folders, ","))
	folders = append(folders, cmd.UID)

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

		libraryPanelSrv, ok := s.registry[entity.StandardKindLibraryPanel]
		if !ok {
			return folder.ErrInternal.Errorf("no library panel service found in registry")
		}
		//	/* TODO: after a decision regarding folder deletion permissions has been made
		//	(https://github.com/grafana/grafana-enterprise/issues/5144),
		//	remove the following call to DeleteInFolders
		//	and remove "user" from the signature of DeleteInFolder in the folder RegistryService.
		//	Context: https://github.com/grafana/grafana/pull/69149#discussion_r1235057903
		//	*/
		// Obs: DeleteInFolders only deletes dangling library panels (not linked to any dashboard) and throws errors if there are connections
		if err := libraryPanelSrv.DeleteInFolders(ctx, cmd.OrgID, folders, cmd.SignedInUser); err != nil {
			s.log.Error("failed to delete dangling library panels in folders", "error", err, "folders", strings.Join(folders, ","))
			return err
		}
		// We need a list of dashboard uids inside the folder to delete related dashboards & public dashboards -
		// we cannot use the dashboard service directly due to circular dependencies, so use the search client to get the dashboards
		request := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Labels: []*resourcepb.Requirement{},
				Fields: []*resourcepb.Requirement{
					{
						Key:      resource.SEARCH_FIELD_FOLDER,
						Operator: string(selection.In),
						Values:   folders,
					},
				},
			},
			Limit: folderSearchLimit}

		res, err := s.dashboardK8sClient.Search(ctx, cmd.OrgID, request)
		if err != nil {
			return folder.ErrInternal.Errorf("failed to fetch dashboards: %w", err)
		}

		hits, err := dashboardsearch.ParseResults(res, 0)
		if err != nil {
			return folder.ErrInternal.Errorf("failed to fetch dashboards: %w", err)
		}
		dashboardUIDs := make([]string, len(hits.Hits))
		for i, dashboard := range hits.Hits {
			dashboardUIDs[i] = dashboard.Name
			err = s.dashboardK8sClient.Delete(ctx, dashboard.Name, cmd.OrgID, metav1.DeleteOptions{})
			if err != nil {
				return folder.ErrInternal.Errorf("failed to delete child dashboard: %w", err)
			}
		}
		// Delete all public dashboards in the folders
		err = s.publicDashboardService.DeleteByDashboardUIDs(ctx, cmd.OrgID, dashboardUIDs)
		if err != nil {
			return folder.ErrInternal.Errorf("failed to delete public dashboards: %w", err)
		}
	}

	err = s.deleteViaK8s(ctx, folders, cmd.OrgID)
	if err != nil {
		return err
	}

	return nil
}

func (s *Service) deleteChildrenInFolder(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error {
	ctx, span := s.tracer.Start(ctx, "folder.deleteChildrenInFolder")
	defer span.End()
	for _, v := range s.registry {
		if err := v.DeleteInFolders(ctx, orgID, folderUIDs, user); err != nil {
			return err
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

	// Check that the user is allowed to move the folder to the destination folder
	hasAccess, evalErr := s.canMove(ctx, cmd)
	if evalErr != nil {
		return nil, evalErr
	}
	if !hasAccess {
		return nil, dashboards.ErrFolderAccessDenied
	}

	f, err := s.updateViaK8s(ctx, folder.UpdateFolderCommand{
		UID:          cmd.UID,
		OrgID:        cmd.OrgID,
		NewParentUID: &cmd.NewParentUID,
		SignedInUser: cmd.SignedInUser,
	})
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to move folder: %w", err)
	}

	if err := s.publishFolderFullPathUpdatedEvent(ctx, f.Updated, cmd.OrgID, cmd.UID); err != nil {
		return nil, err
	}

	return f, nil
}

func (s *Service) GetDescendantCounts(ctx context.Context, q *folder.GetDescendantCountsQuery) (folder.DescendantCounts, error) {
	ctx, span := s.tracer.Start(ctx, "folder.GetDescendantCounts")
	defer span.End()

	if q.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed-in user")
	}
	if q.UID == nil || *q.UID == "" {
		return nil, folder.ErrBadRequest.Errorf("missing UID")
	}
	if q.OrgID < 1 {
		return nil, folder.ErrBadRequest.Errorf("invalid orgID")
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	if s.features.IsEnabledGlobally(featuremgmt.FlagK8SFolderCounts) {
		return s.countFolderContentViaK8s(ctx, q.OrgID, *q.UID)
	}

	folders := []string{*q.UID}
	countsMap := make(folder.DescendantCounts, len(s.registry)+1)
	descendantFolders, err := s.getDescendantsViaK8s(ctx, q.OrgID, *q.UID)
	if err != nil {
		s.log.ErrorContext(ctx, "failed to get descendant folders", "error", err)
		return nil, err
	}

	for _, f := range descendantFolders {
		folders = append(folders, f.UID)
	}
	countsMap[entity.StandardKindFolder] = int64(len(descendantFolders))

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

func toFolderError(err error) error {
	if errors.Is(err, dashboards.ErrDashboardTitleEmpty) {
		return dashboards.ErrFolderTitleEmpty
	}

	if errors.Is(err, dashboards.ErrDashboardUpdateAccessDenied) {
		return dashboards.ErrFolderAccessDenied
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

func (s *Service) getUIDFromLegacyID(ctx context.Context, orgID, id int64) (string, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getUIDFromLegacyID")
	defer span.End()

	f, err := s.getFolderByID(ctx, id, orgID)
	if err != nil {
		return "", err
	}

	return f.UID, nil
}

func (s *Service) getFolderByID(ctx context.Context, id int64, orgID int64) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getFolderByID")
	defer span.End()

	if id == 0 {
		return &folder.GeneralFolder, nil
	}

	folderkey := &resourcepb.ResourceKey{
		Namespace: s.k8sclient.GetNamespace(orgID),
		Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
		Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
	}

	request := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key:    folderkey,
			Fields: []*resourcepb.Requirement{},
			Labels: []*resourcepb.Requirement{
				{
					Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
					Operator: string(selection.In),
					Values:   []string{fmt.Sprintf("%d", id)},
				},
			},
		},
		Limit: folderSearchLimit}

	res, err := s.k8sclient.Search(ctx, orgID, request)
	if err != nil {
		return nil, err
	}

	hits, err := dashboardsearch.ParseResults(res, 0)
	if err != nil {
		return nil, err
	}

	return s.returnFirstFolderSearchResult(ctx, orgID, hits)
}

func (s *Service) returnFirstFolderSearchResult(ctx context.Context, orgID int64, hits v0alpha1.SearchResults) (*folder.Folder, error) {
	if len(hits.Hits) == 0 {
		return nil, dashboards.ErrFolderNotFound
	}

	uid := hits.Hits[0].Name
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	f, err := s.Get(ctx, &folder.GetFolderQuery{UID: &uid, SignedInUser: user, OrgID: orgID})
	if err != nil {
		return nil, err
	}

	return f, nil
}

func (s *Service) getFolderByTitle(ctx context.Context, orgID int64, title string, parentUID *string) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getFolderByTitle")
	defer span.End()

	if title == "" {
		return nil, dashboards.ErrFolderTitleEmpty
	}

	folderkey := &resourcepb.ResourceKey{
		Namespace: s.k8sclient.GetNamespace(orgID),
		Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
		Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
	}

	request := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: folderkey,
			Fields: []*resourcepb.Requirement{
				{
					Key:      resource.SEARCH_FIELD_TITLE_PHRASE, // nolint:staticcheck
					Operator: string(selection.Equals),
					Values:   []string{title},
				},
			},
			Labels: []*resourcepb.Requirement{},
		},
		Limit: folderSearchLimit}

	if parentUID != nil {
		req := []*resourcepb.Requirement{{
			Key:      resource.SEARCH_FIELD_FOLDER,
			Operator: string(selection.In),
			Values:   []string{*parentUID},
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	res, err := s.k8sclient.Search(ctx, orgID, request)
	if err != nil {
		return nil, err
	}

	hits, err := dashboardsearch.ParseResults(res, 0)
	if err != nil {
		return nil, err
	}

	// If we're searching for top-level folders (parentUID == nil), and the first result is not in the root folder, remove it from the results.
	for parentUID == nil && len(hits.Hits) > 0 && hits.Hits[0].Folder != "" {
		hits.Hits = hits.Hits[1:]
	}

	return s.returnFirstFolderSearchResult(ctx, orgID, hits)
}

func (s *Service) getRootFolders(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getRootFolders")
	defer span.End()
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

	children, err := s.getChildrenViaK8s(ctx, *q)
	if err != nil {
		return nil, err
	}

	// add "shared with me" folder on the 1st page
	if (q.Page == 0 || q.Page == 1) && len(q.FolderUIDs) != 0 {
		children = append([]*folder.FolderReference{folder.SharedWithMeFolder.ToFolderReference()}, children...)
	}

	return children, nil
}

func (s *Service) publishFolderFullPathUpdatedEvent(ctx context.Context, timestamp time.Time, orgID int64, folderUID string) error {
	ctx, span := s.tracer.Start(ctx, "folder.publishFolderFullPathUpdatedEvent")
	defer span.End()

	descFolders, err := s.getDescendantsViaK8s(ctx, orgID, folderUID)
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
	ctx, span := s.tracer.Start(ctx, "folder.canMove")
	defer span.End()

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
	ctx, span := s.tracer.Start(ctx, "folder.getFolderAndParentUIDScopes")
	defer span.End()

	folderAndParentUIDScopes := []string{dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}
	if folderUID == folder.GeneralFolderUID {
		return folderAndParentUIDScopes, nil
	}
	folderParents, err := s.getParentsViaK8s(ctx, folder.GetParentsQuery{UID: folderUID, OrgID: orgID})
	if err != nil {
		return nil, err
	}
	for _, newParent := range folderParents {
		scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(newParent.UID)
		folderAndParentUIDScopes = append(folderAndParentUIDScopes, scope)
	}
	return folderAndParentUIDScopes, nil
}
