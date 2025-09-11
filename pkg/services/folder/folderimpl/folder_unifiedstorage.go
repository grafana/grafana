package folderimpl

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/exp/slices"
	"k8s.io/apimachinery/pkg/selection"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util"
)

const folderSearchLimit = 100000
const folderListLimit = 100000

func (s *Service) getFoldersFromApiServer(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getFoldersFromApiServer")
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
	dashFolders, err = s.unifiedStore.GetFolders(ctx, qry)
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders: %w", err)
	}

	return dashFolders, nil
}

func (s *Service) getFromApiServer(ctx context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getFromApiServer")
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
		dashFolder, err = s.unifiedStore.Get(ctx, *q)
		if err != nil {
			return nil, toFolderError(err)
		}
	// nolint:staticcheck
	case q.ID != nil && *q.ID != 0:
		dashFolder, err = s.getFolderByIDFromApiServer(ctx, *q.ID, q.OrgID)
		if err != nil {
			return nil, toFolderError(err)
		}
	case q.Title != nil && *q.Title != "":
		dashFolder, err = s.getFolderByTitleFromApiServer(ctx, q.OrgID, *q.Title, q.ParentUID)
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

// searchFoldesFromApiServer uses the search grpc connection to search folders and returns the hit list
func (s *Service) searchFoldersFromApiServer(ctx context.Context, query folder.SearchFoldersQuery) (model.HitList, error) {
	ctx, span := s.tracer.Start(ctx, "folder.searchFoldersFromApiServer")
	defer span.End()

	if query.OrgID == 0 {
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}
		query.OrgID = requester.GetOrgID()
	}

	request := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: s.k8sclient.GetNamespace(query.OrgID),
				Group:     folderv1.FolderResourceInfo.GroupVersionResource().Group,
				Resource:  folderv1.FolderResourceInfo.GroupVersionResource().Resource,
			},
			Fields: []*resourcepb.Requirement{},
			Labels: []*resourcepb.Requirement{},
		},
		Limit: folderSearchLimit}

	if len(query.UIDs) > 0 {
		request.Options.Fields = []*resourcepb.Requirement{{
			Key:      resource.SEARCH_FIELD_NAME,
			Operator: string(selection.In),
			Values:   query.UIDs,
		}}
	} else if len(query.IDs) > 0 {
		values := make([]string, len(query.IDs))
		for i, id := range query.IDs {
			values[i] = strconv.FormatInt(id, 10)
		}

		request.Options.Labels = append(request.Options.Labels, &resourcepb.Requirement{
			Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
			Operator: string(selection.In),
			Values:   values,
		})
	}

	if query.Title != "" {
		// allow wildcard search
		request.Query = "*" + strings.ToLower(query.Title) + "*"
		// if using query, you need to specify the fields you want
		request.Fields = dashboardsearch.IncludeFields
	}

	if query.Limit > 0 {
		request.Limit = query.Limit
	}

	res, err := s.k8sclient.Search(ctx, query.OrgID, request)
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
			ID:        item.Field.GetNestedInt64(resource.SEARCH_FIELD_LEGACY_ID),
			UID:       item.Name,
			OrgID:     query.OrgID,
			Title:     item.Title,
			URI:       "db/" + slug,
			URL:       dashboards.GetFolderURL(item.Name, slug),
			Type:      model.DashHitFolder,
			FolderUID: item.Folder,
		}
	}

	return hitList, nil
}

func (s *Service) getFolderByIDFromApiServer(ctx context.Context, id int64, orgID int64) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getFolderByIDFromApiServer")
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
	ctx, span := s.tracer.Start(ctx, "folder.getFolderByTitleFromApiServer")
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

func (s *Service) getChildrenFromApiServer(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getChildrenFromApiServer")
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
		return s.getRootFoldersFromApiServer(ctx, q)
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

	children, err := s.unifiedStore.GetChildren(ctx, *q)
	if err != nil {
		return nil, err
	}

	return children, nil
}

func (s *Service) getRootFoldersFromApiServer(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getRootFoldersFromApiServer")
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

	children, err := s.unifiedStore.GetChildren(ctx, *q)
	if err != nil {
		return nil, err
	}

	// add "shared with me" folder on the 1st page
	if (q.Page == 0 || q.Page == 1) && len(q.FolderUIDs) != 0 {
		children = append([]*folder.FolderReference{folder.SharedWithMeFolder.ToFolderReference()}, children...)
	}

	return children, nil
}

func (s *Service) getParentsFromApiServer(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getParentsFromApiServer")
	defer span.End()

	if q.UID == accesscontrol.GeneralFolderUID {
		return nil, nil
	}
	if q.UID == folder.SharedWithMeFolderUID {
		return []*folder.Folder{&folder.SharedWithMeFolder}, nil
	}

	return s.unifiedStore.GetParents(ctx, q)
}

func (s *Service) createOnApiServer(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
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
		// TODO: Today, if a UID isn't specified, the dashboard store
		// generates a new UID. The new folder store will need to do this as
		// well, but for now we take the UID from the newly created folder.
		UID:          trimmedUID,
		OrgID:        cmd.OrgID,
		Title:        cmd.Title,
		Description:  cmd.Description,
		ParentUID:    cmd.ParentUID,
		SignedInUser: cmd.SignedInUser,
		// pass along provisioning details
		ManagerKindClassicFP: cmd.ManagerKindClassicFP, // nolint:staticcheck
	}

	f, err := s.unifiedStore.Create(ctx, *cmd)
	if err != nil {
		return nil, err
	}

	return f, nil
}

func (s *Service) updateOnApiServer(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.updateOnApiServer")
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

	foldr, err := s.unifiedStore.Update(ctx, folder.UpdateFolderCommand{
		UID:                  cmd.UID,
		OrgID:                cmd.OrgID,
		NewTitle:             cmd.NewTitle,
		NewDescription:       cmd.NewDescription,
		SignedInUser:         user,
		Overwrite:            cmd.Overwrite,
		Version:              cmd.Version,
		ManagerKindClassicFP: cmd.ManagerKindClassicFP, // nolint:static
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
	ctx, span := s.tracer.Start(ctx, "folder.deleteFromApiServer")
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

	descFolders, err := s.unifiedStore.GetDescendants(ctx, cmd.OrgID, cmd.UID)
	if err != nil {
		return err
	}

	folders := []string{}
	for _, f := range descFolders {
		folders = append(folders, f.UID)
	}
	// must delete children first, then the parent folder
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

	err = s.unifiedStore.Delete(ctx, folders, cmd.OrgID)
	if err != nil {
		return err
	}

	return nil
}

func (s *Service) moveOnApiServer(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.moveOnApiServer")
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
	ctx, span := s.tracer.Start(ctx, "folder.canMoveViaApiServer")
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
	newFolderAndParentUIDs, err := s.getFolderAndParentUIDScopesViaApiServer(ctx, parentUID, cmd.OrgID)
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

func (s *Service) getFolderAndParentUIDScopesViaApiServer(ctx context.Context, folderUID string, orgID int64) ([]string, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getFolderAndParentUIDScopesViaApiServer")
	defer span.End()

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
	ctx, span := s.tracer.Start(ctx, "folder.getDescendantCountsFromApiServer")
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
