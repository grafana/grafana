package folderimpl

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/exp/slices"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/client-go/dynamic"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util"
)

// interface to allow for testing
type folderK8sHandler interface {
	getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool)
	getNamespace(orgID int64) string
	getSearcher(ctx context.Context) resource.ResourceClient
}

var _ folderK8sHandler = (*foldk8sHandler)(nil)

type foldk8sHandler struct {
	cfg                    *setting.Cfg
	namespacer             request.NamespaceMapper
	gvr                    schema.GroupVersionResource
	restConfigProvider     func(ctx context.Context) *clientrest.Config
	recourceClientProvider func(ctx context.Context) resource.ResourceClient
}

func (s *Service) getFoldersFromApiServer(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
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
	dashFolders, err = s.unifiedStore.GetFolders(ctx, qry)
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders: %w", err)
	}

	return dashFolders, nil
}

func (s *Service) getFromApiServer(ctx context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
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
	case q.UID != nil:
		if *q.UID == "" {
			return &folder.GeneralFolder, nil
		}
		dashFolder, err = s.unifiedStore.Get(ctx, *q)
		if err != nil {
			return nil, toFolderError(err)
		}
	// nolint:staticcheck
	case q.ID != nil:
		dashFolder, err = s.getFolderByIDFromApiServer(ctx, *q.ID, q.OrgID)
		if err != nil {
			return nil, toFolderError(err)
		}
	case q.Title != nil:
		dashFolder, err = s.getFolderByTitleFromApiServer(ctx, q.OrgID, *q.Title, q.ParentUID)
		if err != nil {
			return nil, toFolderError(err)
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

	f, err = s.setFullpath(ctx, f, q.SignedInUser, false)
	if err != nil {
		return nil, err
	}

	return f, err
}

func (s *Service) getFolderByIDFromApiServer(ctx context.Context, id int64, orgID int64) (*folder.Folder, error) {
	if id == 0 {
		return &folder.GeneralFolder, nil
	}

	folderkey := &resource.ResourceKey{
		Namespace: s.k8sclient.getNamespace(orgID),
		Group:     v0alpha1.FolderResourceInfo.GroupVersionResource().Group,
		Resource:  v0alpha1.FolderResourceInfo.GroupVersionResource().Resource,
	}

	request := &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Key:    folderkey,
			Fields: []*resource.Requirement{},
			Labels: []*resource.Requirement{
				{
					Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
					Operator: string(selection.In),
					Values:   []string{fmt.Sprintf("%d", id)},
				},
			},
		},
		Limit: 100000}

	client := s.k8sclient.getSearcher(ctx)

	res, err := client.Search(ctx, request)
	if err != nil {
		return nil, err
	}

	hits, err := dashboardsearch.ParseResults(res, 0)
	if err != nil {
		return nil, err
	}

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

func (s *Service) getFolderByTitleFromApiServer(ctx context.Context, orgID int64, title string, parentUID *string) (*folder.Folder, error) {
	if title == "" {
		return nil, dashboards.ErrFolderTitleEmpty
	}

	folderkey := &resource.ResourceKey{
		Namespace: s.k8sclient.getNamespace(orgID),
		Group:     v0alpha1.FolderResourceInfo.GroupVersionResource().Group,
		Resource:  v0alpha1.FolderResourceInfo.GroupVersionResource().Resource,
	}

	request := &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Key: folderkey,
			Fields: []*resource.Requirement{
				{
					Key:      resource.SEARCH_FIELD_TITLE,
					Operator: string(selection.In),
					Values:   []string{title},
				},
			},
			Labels: []*resource.Requirement{},
		},
		Limit: 100000}

	if parentUID != nil {
		req := []*resource.Requirement{{
			Key:      resource.SEARCH_FIELD_FOLDER,
			Operator: string(selection.In),
			Values:   []string{*parentUID},
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	client := s.k8sclient.getSearcher(ctx)

	res, err := client.Search(ctx, request)
	if err != nil {
		return nil, err
	}

	hits, err := dashboardsearch.ParseResults(res, 0)
	if err != nil {
		return nil, err
	}

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

func (s *Service) getChildrenFromApiServer(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.Folder, error) {
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
		return s.getRootFoldersFromApiServer(ctx, q)
	}

	var err error
	// TODO: figure out what to do with Guardian
	// we only need to check access to the folder
	// if the parent is accessible then the subfolders are accessible as well (due to inheritance)
	f := &folder.Folder{
		UID: q.UID,
	}
	g, err := guardian.NewByFolder(ctx, f, q.OrgID, q.SignedInUser)
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

	children, err := s.unifiedStore.GetChildren(ctx, *q)
	if err != nil {
		return nil, err
	}

	return children, nil
}

func (s *Service) getRootFoldersFromApiServer(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.Folder, error) {
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

	children, err := s.unifiedStore.GetChildren(ctx, *q)
	if err != nil {
		return nil, err
	}

	// add "shared with me" folder on the 1st page
	if (q.Page == 0 || q.Page == 1) && len(q.FolderUIDs) != 0 {
		children = append([]*folder.Folder{&folder.SharedWithMeFolder}, children...)
	}

	return children, nil
}

func (s *Service) getParentsFromApiServer(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	if q.UID == accesscontrol.GeneralFolderUID {
		return nil, nil
	}
	if q.UID == folder.SharedWithMeFolderUID {
		return []*folder.Folder{&folder.SharedWithMeFolder}, nil
	}

	return s.unifiedStore.GetParents(ctx, q)
}

func (s *Service) createOnApiServer(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
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

	user := cmd.SignedInUser

	cmd = &folder.CreateFolderCommand{
		// TODO: Today, if a UID isn't specified, the dashboard store
		// generates a new UID. The new folder store will need to do this as
		// well, but for now we take the UID from the newly created folder.
		UID:          trimmedUID,
		OrgID:        cmd.OrgID,
		Title:        cmd.Title,
		Description:  cmd.Description,
		ParentUID:    cmd.ParentUID,
		SignedInUser: cmd.SignedInUser,
	}

	f, err := s.unifiedStore.Create(ctx, *cmd)
	if err != nil {
		return nil, err
	}

	f, err = s.setFullpath(ctx, f, user, false)
	if err != nil {
		return nil, err
	}

	return f, nil
}

func (s *Service) updateOnApiServer(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
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

	f := &folder.Folder{
		UID: cmd.UID,
	}
	g, err := guardian.NewByFolder(ctx, f, cmd.OrgID, cmd.SignedInUser)
	if err != nil {
		return nil, err
	}

	if canSave, err := g.CanSave(); err != nil || !canSave {
		if err != nil {
			return nil, err
		}
		return nil, toFolderError(dashboards.ErrDashboardUpdateAccessDenied)
	}

	user := cmd.SignedInUser

	foldr, err := s.unifiedStore.Update(ctx, folder.UpdateFolderCommand{
		UID:            cmd.UID,
		OrgID:          cmd.OrgID,
		NewTitle:       cmd.NewTitle,
		NewDescription: cmd.NewDescription,
		SignedInUser:   user,
	})

	if err != nil {
		return nil, err
	}

	if cmd.NewTitle != nil {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()

		if err := s.publishFolderFullPathUpdatedEventViaApiServer(ctx, foldr.Updated, cmd.OrgID, cmd.UID); err != nil {
			return nil, err
		}
	}

	// always expose the dashboard store sequential ID
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()

	return foldr, nil
}

func (s *Service) deleteFromApiServer(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	if cmd.SignedInUser == nil {
		return folder.ErrBadRequest.Errorf("missing signed in user")
	}
	if cmd.UID == "" {
		return folder.ErrBadRequest.Errorf("missing UID")
	}
	if cmd.OrgID < 1 {
		return folder.ErrBadRequest.Errorf("invalid orgID")
	}

	f := &folder.Folder{
		UID: cmd.UID,
	}
	guard, err := guardian.NewByFolder(ctx, f, cmd.OrgID, cmd.SignedInUser)
	if err != nil {
		return err
	}

	if canSave, err := guard.CanDelete(); err != nil || !canSave {
		if err != nil {
			return toFolderError(err)
		}
		return dashboards.ErrFolderAccessDenied
	}

	descFolders, err := s.unifiedStore.GetDescendants(ctx, cmd.OrgID, cmd.UID)
	if err != nil {
		return err
	}

	folders := []string{cmd.UID}
	for _, f := range descFolders {
		folders = append(folders, f.UID)
	}

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

		// if dashboard restore is on we don't delete public dashboards, the hard delete will take care of it later
		if !s.features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore) {
			// We need a list of dashboard uids inside the folder to delete related public dashboards
			dashes, err := s.dashboardStore.FindDashboards(ctx, &dashboards.FindPersistedDashboardsQuery{SignedInUser: cmd.SignedInUser, FolderUIDs: folders, OrgId: cmd.OrgID})
			if err != nil {
				return folder.ErrInternal.Errorf("failed to fetch dashboards: %w", err)
			}

			dashboardUIDs := make([]string, 0, len(dashes))
			for _, dashboard := range dashes {
				dashboardUIDs = append(dashboardUIDs, dashboard.UID)
			}

			// Delete all public dashboards in the folders
			err = s.publicDashboardService.DeleteByDashboardUIDs(ctx, cmd.OrgID, dashboardUIDs)
			if err != nil {
				return folder.ErrInternal.Errorf("failed to delete public dashboards: %w", err)
			}
		}
	}

	err = s.unifiedStore.Delete(ctx, folders, cmd.OrgID)
	if err != nil {
		return err
	}

	return nil
}

func (s *Service) moveOnApiServer(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.Move")
	defer span.End()

	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	// k6-specific check to prevent folder move for a k6-app folder and its children
	if cmd.UID == accesscontrol.K6FolderUID {
		return nil, folder.ErrBadRequest.Errorf("k6 project may not be moved")
	}

	f, err := s.unifiedStore.Get(ctx, folder.GetFolderQuery{
		UID:          &cmd.UID,
		OrgID:        cmd.OrgID,
		SignedInUser: cmd.SignedInUser,
	})
	if err != nil {
		return nil, err
	}

	if f != nil && f.ParentUID == accesscontrol.K6FolderUID {
		return nil, folder.ErrBadRequest.Errorf("k6 project may not be moved")
	}

	// Check that the user is allowed to move the folder to the destination folder
	hasAccess, evalErr := s.canMoveViaApiServer(ctx, cmd)
	if evalErr != nil {
		return nil, evalErr
	}
	if !hasAccess {
		return nil, dashboards.ErrFolderAccessDenied
	}

	// here we get the folder, we need to get the height of current folder
	// and the depth of the new parent folder, the sum can't bypass 8
	folderHeight, err := s.unifiedStore.GetHeight(ctx, cmd.UID, cmd.OrgID, &cmd.NewParentUID)
	if err != nil {
		return nil, err
	}
	parents, err := s.unifiedStore.GetParents(ctx, folder.GetParentsQuery{UID: cmd.NewParentUID, OrgID: cmd.OrgID})
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

	f, err = s.unifiedStore.Update(ctx, folder.UpdateFolderCommand{
		UID:          cmd.UID,
		OrgID:        cmd.OrgID,
		NewParentUID: &cmd.NewParentUID,
		SignedInUser: cmd.SignedInUser,
	})
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to move folder: %w", err)
	}

	if err := s.publishFolderFullPathUpdatedEventViaApiServer(ctx, f.Updated, cmd.OrgID, cmd.UID); err != nil {
		return nil, err
	}

	return f, nil
}

func (s *Service) publishFolderFullPathUpdatedEventViaApiServer(ctx context.Context, timestamp time.Time, orgID int64, folderUID string) error {
	ctx, span := s.tracer.Start(ctx, "folder.publishFolderFullPathUpdatedEventViaApiServer")
	defer span.End()

	descFolders, err := s.unifiedStore.GetDescendants(ctx, orgID, folderUID)
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

func (s *Service) canMoveViaApiServer(ctx context.Context, cmd *folder.MoveFolderCommand) (bool, error) {
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
	newFolderAndParentUIDs, err := s.getFolderAndParentUIDScopesViaApiServer(ctx, parentUID, cmd.OrgID)
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

func (s *Service) getFolderAndParentUIDScopesViaApiServer(ctx context.Context, folderUID string, orgID int64) ([]string, error) {
	folderAndParentUIDScopes := []string{dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}
	if folderUID == folder.GeneralFolderUID {
		return folderAndParentUIDScopes, nil
	}
	folderParents, err := s.unifiedStore.GetParents(ctx, folder.GetParentsQuery{UID: folderUID, OrgID: orgID})
	if err != nil {
		return nil, err
	}
	for _, newParent := range folderParents {
		scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(newParent.UID)
		folderAndParentUIDScopes = append(folderAndParentUIDScopes, scope)
	}
	return folderAndParentUIDScopes, nil
}

func (s *Service) getDescendantCountsFromApiServer(ctx context.Context, q *folder.GetDescendantCountsQuery) (folder.DescendantCounts, error) {
	if q.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed-in user")
	}
	if q.UID == nil || *q.UID == "" {
		return nil, folder.ErrBadRequest.Errorf("missing UID")
	}
	if q.OrgID < 1 {
		return nil, folder.ErrBadRequest.Errorf("invalid orgID")
	}

	if s.features.IsEnabledGlobally(featuremgmt.FlagK8SFolderCounts) {
		return s.unifiedStore.(*FolderUnifiedStoreImpl).CountFolderContent(ctx, q.OrgID, *q.UID)
	}

	folders := []string{*q.UID}
	countsMap := make(folder.DescendantCounts, len(s.registry)+1)
	descendantFolders, err := s.unifiedStore.GetDescendants(ctx, q.OrgID, *q.UID)
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

// -----------------------------------------------------------------------------------------
// Folder k8s functions
// -----------------------------------------------------------------------------------------

func (fk8s *foldk8sHandler) getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool) {
	cfg := fk8s.restConfigProvider(ctx)
	if cfg == nil {
		return nil, false
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, false
	}

	return dyn.Resource(fk8s.gvr).Namespace(fk8s.getNamespace(orgID)), true
}

func (fk8s *foldk8sHandler) getNamespace(orgID int64) string {
	return fk8s.namespacer(orgID)
}

func (fk8s *foldk8sHandler) getSearcher(ctx context.Context) resource.ResourceClient {
	return fk8s.recourceClientProvider(ctx)
}
