package folderimpl

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const folderSearchLimit = 100000
const folderListLimit = 100000

// descendantsBatchSize bounds how many parent UIDs are sent in a single
// multi-value `In` Search when walking a subtree in GetDescendants. K=100
// keeps per-call latency on the same order as a single-parent Search while
// reducing the call count for non-trivial subtrees by ~100x.
const descendantsBatchSize = 100

// searchPageSize bounds the per-page hit count when searchChildren paginates
// internally. At ~100 bytes per hit this keeps each response well under the
// default 4 MiB gRPC max receive size, so a high-fanout search is split into
// multiple round-trips instead of failing with ResourceExhausted.
const searchPageSize = 10000

func (s *Service) GetFolders(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.GetFolders")
	defer span.End()

	if q.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	qry := folder.NewGetFoldersQuery(q)
	permissions := q.SignedInUser.GetPermissions()
	folderPermissions := permissions[folder.ActionFoldersRead]
	qry.AncestorUIDs = make([]string, 0, len(folderPermissions))
	if len(folderPermissions) == 0 && !q.SignedInUser.GetIsGrafanaAdmin() {
		return nil, nil
	}
	for _, p := range folderPermissions {
		if p == folder.ScopeFoldersAll {
			// no need to query for folders with permissions
			// the user has permission to access all folders
			qry.AncestorUIDs = nil
			break
		}
		if folderUid, found := strings.CutPrefix(p, folder.ScopeFoldersPrefix); found {
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
		dashFolder, err = s.unifiedStore.Get(ctx, *q)
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

// SearchFolders uses the search grpc connection to search folders and returns the hit list
func (s *Service) SearchFolders(ctx context.Context, query folder.SearchFoldersQuery) (model.HitList, error) {
	ctx, span := s.tracer.Start(ctx, "folder.SearchFolders")
	defer span.End()
	// TODO:
	// - implement filtering by alerting folders and k6 folders (see the dashboards store `FindDashboards` method for reference)
	// - implement fallback on search client in unistore to go to legacy store (will need to read from dashboard store)

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
		// or perform exact match if requested
		if query.TitleExactMatch {
			request.Query = query.Title
		}

		// if using query, you need to specify the fields you want
		request.Fields = dashboardsearch.IncludeFields
	}

	if query.Limit > 0 {
		request.Limit = query.Limit
	}

	parsedResults, err := dashboardsearch.SearchAll(ctx, query.OrgID, request, s.k8sclient.Search)
	if err != nil {
		return nil, err
	}

	hitList := make([]*model.Hit, len(parsedResults.Hits))
	for i, item := range parsedResults.Hits {
		slug := slugify.Slugify(item.Title)
		hitList[i] = &model.Hit{
			ID:          item.Field.GetNestedInt64(resource.SEARCH_FIELD_LEGACY_ID),
			UID:         item.Name,
			OrgID:       query.OrgID,
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
		return nil, folder.ErrTitleEmpty
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

func (s *Service) GetChildren(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	ctx, span := s.tracer.Start(ctx, "folder.GetChildren")
	defer span.End()

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
	evaluator := accesscontrol.EvalPermission(folder.ActionFoldersRead, folder.ScopeFoldersProvider.GetResourceScopeUID(q.UID))
	if q.Permission == dashboardaccess.PERMISSION_EDIT {
		evaluator = accesscontrol.EvalPermission(folder.ActionFoldersWrite, folder.ScopeFoldersProvider.GetResourceScopeUID(q.UID))
	}
	if hasAccess, err := s.accessControl.Evaluate(ctx, q.SignedInUser, evaluator); err != nil || !hasAccess {
		if err != nil {
			return nil, err
		}
		return nil, folder.ErrAccessDenied
	}

	children, err := s.unifiedStore.GetChildren(ctx, *q)
	if err != nil {
		return nil, err
	}

	return children, nil
}

func (s *Service) getRootFolders(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getRootFolders")
	defer span.End()
	permissions := q.SignedInUser.GetPermissions()
	var folderPermissions []string
	if q.Permission == dashboardaccess.PERMISSION_EDIT {
		folderPermissions = permissions[folder.ActionFoldersWrite]
	} else {
		folderPermissions = permissions[folder.ActionFoldersRead]
	}

	if len(folderPermissions) == 0 && !q.SignedInUser.GetIsGrafanaAdmin() {
		return nil, nil
	}

	q.FolderUIDs = make([]string, 0, len(folderPermissions))
	for _, p := range folderPermissions {
		if p == folder.ScopeFoldersAll {
			// no need to query for folders with permissions
			// the user has permission to access all folders
			q.FolderUIDs = nil
			break
		}
		if folderUid, found := strings.CutPrefix(p, folder.ScopeFoldersPrefix); found {
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

func (s *Service) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.GetParents")
	defer span.End()

	if q.UID == accesscontrol.GeneralFolderUID {
		return nil, nil
	}
	if q.UID == folder.SharedWithMeFolderUID {
		return []*folder.Folder{&folder.SharedWithMeFolder}, nil
	}

	return s.unifiedStore.GetParents(ctx, q)
}

func (s *Service) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.Create")
	defer span.End()

	if cmd.SignedInUser == nil || cmd.SignedInUser.IsNil() {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	cmd = &folder.CreateFolderCommand{
		// TODO: Today, if a UID isn't specified, the dashboard store
		// generates a new UID. The new folder store will need to do this as
		// well, but for now we take the UID from the newly created folder.
		UID:          cmd.UID,
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

func (s *Service) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	ctx, span := s.tracer.Start(ctx, "folder.Update")
	defer span.End()

	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	folder, err := s.unifiedStore.Update(ctx, folder.UpdateFolderCommand{
		UID:                  cmd.UID,
		OrgID:                cmd.OrgID,
		NewTitle:             cmd.NewTitle,
		NewDescription:       cmd.NewDescription,
		SignedInUser:         cmd.SignedInUser,
		Overwrite:            cmd.Overwrite,
		Version:              cmd.Version,
		ManagerKindClassicFP: cmd.ManagerKindClassicFP, // nolint:staticcheck
	})

	if err != nil {
		return nil, err
	}

	// always expose the dashboard store sequential ID
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()

	return folder, nil
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

	evaluator := accesscontrol.EvalPermission(folder.ActionFoldersDelete, folder.ScopeFoldersProvider.GetResourceScopeUID(cmd.UID))
	if hasAccess, err := s.accessControl.Evaluate(ctx, cmd.SignedInUser, evaluator); err != nil || !hasAccess {
		if err != nil {
			return toFolderError(err)
		}
		return folder.ErrAccessDenied
	}

	descFolders, err := s.unifiedStore.GetDescendants(ctx, cmd.OrgID, cmd.UID)
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

		hits, err := dashboardsearch.SearchAll(ctx, cmd.OrgID, request, s.dashboardK8sClient.Search)
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
		return nil, folder.ErrAccessDenied
	}

	f, err := s.unifiedStore.Update(ctx, folder.UpdateFolderCommand{
		UID:          cmd.UID,
		OrgID:        cmd.OrgID,
		NewParentUID: &cmd.NewParentUID,
		SignedInUser: cmd.SignedInUser,
	})
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to move folder: %w", err)
	}
	return f, nil
}

func (s *Service) canMove(ctx context.Context, cmd *folder.MoveFolderCommand) (bool, error) {
	ctx, span := s.tracer.Start(ctx, "folder.canMove")
	defer span.End()

	// Check that the user is allowed to move the folder to the destination folder
	var evaluator accesscontrol.Evaluator
	parentUID := cmd.NewParentUID
	if parentUID != "" {
		legacyEvaluator := accesscontrol.EvalPermission(folder.ActionFoldersWrite, folder.ScopeFoldersProvider.GetResourceScopeUID(cmd.NewParentUID))
		newEvaluator := accesscontrol.EvalPermission(folder.ActionFoldersCreate, folder.ScopeFoldersProvider.GetResourceScopeUID(cmd.NewParentUID))
		evaluator = accesscontrol.EvalAny(legacyEvaluator, newEvaluator)
	} else {
		// Evaluate folder creation permission when moving folder to the root level
		evaluator = accesscontrol.EvalPermission(folder.ActionFoldersCreate, folder.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID))
		parentUID = folder.GeneralFolderUID
	}
	if hasAccess, err := s.accessControl.Evaluate(ctx, cmd.SignedInUser, evaluator); err != nil {
		return false, err
	} else if !hasAccess {
		return false, folder.ErrMoveAccessDenied.Errorf("user does not have permissions to move a folder to folder with UID %s", parentUID)
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
	currentFolderScope := folder.ScopeFoldersProvider.GetResourceScopeUID(cmd.UID)
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
		return false, folder.ErrAccessEscalation.Errorf("user cannot move a folder to another folder where they have higher permissions")
	}
	return true, nil
}

func (s *Service) getFolderAndParentUIDScopes(ctx context.Context, folderUID string, orgID int64) ([]string, error) {
	ctx, span := s.tracer.Start(ctx, "folder.getFolderAndParentUIDScopes")
	defer span.End()

	folderAndParentUIDScopes := []string{folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}
	if folderUID == folder.GeneralFolderUID {
		return folderAndParentUIDScopes, nil
	}
	folderParents, err := s.unifiedStore.GetParents(ctx, folder.GetParentsQuery{UID: folderUID, OrgID: orgID})
	if err != nil {
		return nil, err
	}
	for _, newParent := range folderParents {
		scope := folder.ScopeFoldersProvider.GetResourceScopeUID(newParent.UID)
		folderAndParentUIDScopes = append(folderAndParentUIDScopes, scope)
	}
	return folderAndParentUIDScopes, nil
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

	return s.unifiedStore.(*FolderUnifiedStoreImpl).CountFolderContent(ctx, q.OrgID, *q.UID)
}
