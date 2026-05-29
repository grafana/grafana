package folders

import (
	"context"
	"fmt"
	"slices"
	"strings"

	apiequality "k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util"
)

// ErrAPIInvalidUID and ErrAPIUIDTooLong are instantiated errutil.Error values
// created from errutil.BadRequest bases, so the apiserver renders them via
// APIStatus as 400 (not "Unhandled Error" 500). They wrap the legacy
// dashboards sentinels via %w so errors.Is/As keeps matching for /api/folders
// consumers (ToFolderErrorResponse). Defined here rather than in
// pkg/services/folder/model.go to avoid the dashboards->folder import cycle.
var (
	ErrAPIInvalidUID = errutil.BadRequest("folder.invalid-uid-chars", errutil.WithPublicMessage("uid contains illegal characters")).
				Errorf("%w", dashboards.ErrDashboardInvalidUid)
	ErrAPIUIDTooLong = errutil.BadRequest("folder.uid-too-long", errutil.WithPublicMessage("uid too long, max 40 characters")).
				Errorf("%w", dashboards.ErrDashboardUidTooLong)
)

var errOwnerRefsOnManagedFolder = fmt.Errorf("cannot set owner references on folders managed by a repository")

func isRepoManaged(f *folders.Folder) bool {
	meta, err := utils.MetaAccessor(f)
	if err != nil {
		return false
	}
	kind := meta.GetAnnotation(utils.AnnoKeyManagerKind)
	return kind != "" && utils.ParseManagerKindString(kind) == utils.ManagerKindRepo
}

func validateOwnerReferencesOnManagedFolder(obj *folders.Folder, old *folders.Folder) error {
	if !isRepoManaged(obj) && (old == nil || !isRepoManaged(old)) {
		return nil
	}

	gr := schema.GroupResource{
		Group:    folders.FolderResourceInfo.GroupVersionResource().Group,
		Resource: folders.FolderResourceInfo.GroupVersionResource().Resource,
	}

	if old == nil {
		if len(obj.OwnerReferences) > 0 {
			return apierrors.NewForbidden(gr, obj.Name, errOwnerRefsOnManagedFolder)
		}
		return nil
	}

	if !apiequality.Semantic.DeepEqual(old.OwnerReferences, obj.OwnerReferences) {
		return apierrors.NewForbidden(gr, obj.Name, errOwnerRefsOnManagedFolder)
	}

	return nil
}

func validateOnCreate(ctx context.Context, f *folders.Folder, getter parentsGetter, maxDepth int) error {
	id := f.Name

	if slices.Contains([]string{
		folder.GeneralFolderUID,
		folder.SharedWithMeFolderUID,
	}, id) {
		return folder.ErrAPIInvalidUID
	}

	meta, err := utils.MetaAccessor(f)
	if err != nil {
		return fmt.Errorf("unable to read metadata from object: %w", err)
	}

	// UID format is only validated on create. On update the Kubernetes API server enforces
	// that the object name (which maps to the UID) is immutable, so re-validating here
	// would be redundant.
	if !util.IsValidShortUID(id) {
		return ErrAPIInvalidUID
	}

	if util.IsShortUIDTooLong(id) {
		return ErrAPIUIDTooLong
	}

	f.Spec.Title = strings.TrimSpace(f.Spec.Title)

	if f.Spec.Title == "" {
		return folder.ErrAPITitleEmpty
	}

	if strings.EqualFold(f.Spec.Title, dashboards.RootFolderName) {
		return folder.ErrNameExists.Errorf("a folder with that name already exists")
	}

	parentName := meta.GetFolder()
	if folder.IsRootFolderUID(parentName) {
		return nil // OK, we do not need to validate the tree
	}

	if parentName == f.Name {
		return folder.ErrAPIFolderCannotBeParentOfItself
	}

	// note: `parents` will include itself as the last item
	parents, err := getter(ctx, f)
	if err != nil {
		return fmt.Errorf("unable to create folder inside parent: %w", err)
	}

	// Can not create a folder that will be too deep.
	// We need to add +1 as we also have the root folder as part of the parents.
	if len(parents.Items) > maxDepth+1 {
		return folder.ErrMaximumDepthReached.Errorf("folder max depth exceeded, max depth is %d", maxDepth)
	}

	return nil
}

func validateOnUpdate(ctx context.Context,
	obj *folders.Folder,
	old *folders.Folder,
	getter rest.Getter,
	parents parentsGetter,
	searcher resourcepb.ResourceIndexClient,
	accessClient authlib.AccessClient,
	maxDepth int,
) error {
	folderObj, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}
	oldFolder, err := utils.MetaAccessor(old)
	if err != nil {
		return err
	}

	obj.Spec.Title = strings.TrimSpace(obj.Spec.Title)

	if obj.Spec.Title == "" {
		return folder.ErrAPITitleEmpty
	}

	if strings.EqualFold(obj.Spec.Title, dashboards.RootFolderName) {
		return folder.ErrNameExists.Errorf("a folder with that name already exists")
	}

	if folderObj.GetFolder() == oldFolder.GetFolder() {
		return nil
	}

	// the k6 folder itself may not be moved (matches legacy folder.Service.Move)
	if obj.Name == accesscontrol.K6FolderUID {
		return folder.ErrBadRequest.Errorf("k6 project may not be moved")
	}

	// Validate the move operation
	newParent := folderObj.GetFolder()

	// folder cannot be moved to a k6 folder
	if newParent == accesscontrol.K6FolderUID {
		return folder.ErrFolderCannotBeMovedToK6.Errorf("k6 project may not be moved")
	}

	if err := checkMoveAccess(ctx, obj.Namespace, obj.Name, oldFolder.GetFolder(), newParent, accessClient); err != nil {
		return err
	}

	// If we move to root, we don't need to validate the depth, because the folder already existed
	// before and wasn't too deep. This move will make it more shallow.
	//
	// We also don't need to validate circular references because the root folder cannot have a parent.
	if folder.IsRootFolderUID(newParent) {
		return nil
	}

	// folder cannot be moved into the k6 folder
	if newParent == accesscontrol.K6FolderUID {
		return folder.ErrFolderCannotBeMovedToK6.Errorf("k6 project may not be moved")
	}

	parentObj, err := getter.Get(ctx, newParent, &metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("move target not found %w", err)
	}
	parent, ok := parentObj.(*folders.Folder)
	if !ok {
		return fmt.Errorf("expected folder, found %T", parentObj)
	}
	info, err := parents(ctx, parent)
	if err != nil {
		return err
	}

	// Check that the folder being moved is not an ancestor of the target parent.
	// This prevents circular references (e.g., moving A under B when B is already under A).
	for _, ancestor := range info.Items {
		if ancestor.Name == obj.Name {
			return folder.ErrCircularReference.Errorf("cannot move folder under its own descendant, this would create a circular reference")
		}
	}

	// if by moving a folder we exceed the max depth just from its parents + itself, return an error
	if len(info.Items) > maxDepth+1 {
		return folder.ErrMaximumDepthReached.Errorf("maximum folder depth reached")
	}
	// To try to save some computation, get the parents of the old parent (this is typically cheaper
	// than looking at the children of the folder). If the old parent has more parents or the same
	// number of parents as the new parent, we can return early, because we know the folder had to be
	// safe from the creation validation. If we cannot access the older parent, we will continue to check the children.
	if canSkipChildrenCheck(ctx, oldFolder, getter, parents, len(info.Items)) {
		return nil
	}

	// Now comes the more expensive part: we need to check if moving this folder will cause
	// any descendant folders to exceed the max depth.
	//
	// Calculate the maximum allowed subtree depth after the move.
	allowedDepth := (maxDepth + 1) - len(info.Items)
	if allowedDepth <= 0 {
		return nil
	}

	return checkSubtreeDepth(ctx, searcher, obj.Namespace, obj.Name, allowedDepth, maxDepth)
}

// folderTier (declared in sub_access.go) is the Viewer/Editor/Admin level used
// by the /access subresource. Comparing tiers across the move catches
// role-level escalations without firing on per-verb churn.
//
// Only the folder tier is compared. Built-in roles bundle dashboard, library
// panel, alert, and annotation actions with the folder tier, so a folder-tier
// jump catches them transitively. Custom roles that grant sub-resource
// actions directly at folder scope without folder access are not caught here.

// tierProbes are the verbs we ask Zanzana about to resolve a tier. setperms
// signals Admin, the Editor verbs (create/update/delete) collectively signal
// Editor, and get alone signals Viewer.
var tierProbes = []struct {
	suffix string
	verb   string
}{
	{"get", utils.VerbGet},
	{"create", utils.VerbCreate},
	{"update", utils.VerbUpdate},
	{"delete", utils.VerbDelete},
	{"setperms", utils.VerbSetPermissions},
}

func checkMoveAccess(
	ctx context.Context,
	namespace string,
	sourceUID string,
	oldParentUID string,
	newParentUID string,
	accessClient authlib.AccessClient,
) error {
	if accessClient == nil {
		return nil
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	folderGVR := folders.FolderResourceInfo.GroupVersionResource()

	const (
		writeDestKey    = "writeDest"
		newFolderPrefix = "newFolder|"
		oldFolderPrefix = "oldFolder|"
	)

	checks := make([]authlib.BatchCheckItem, 0, 1+2*len(tierProbes))

	// Destination-write check: can the user create folders under newParentUID?
	checks = append(checks, authlib.BatchCheckItem{
		CorrelationID: writeDestKey,
		Verb:          utils.VerbCreate,
		Group:         folderGVR.Group,
		Resource:      folderGVR.Resource,
		Folder:        newParentUID,
	})

	// Folder escalation context: source folder permissions under new vs old parent.
	for _, p := range tierProbes {
		checks = append(checks,
			authlib.BatchCheckItem{
				CorrelationID: newFolderPrefix + p.suffix,
				Verb:          p.verb,
				Group:         folderGVR.Group,
				Resource:      folderGVR.Resource,
				Name:          sourceUID,
				Folder:        newParentUID,
			},
			authlib.BatchCheckItem{
				CorrelationID: oldFolderPrefix + p.suffix,
				Verb:          p.verb,
				Group:         folderGVR.Group,
				Resource:      folderGVR.Resource,
				Name:          sourceUID,
				Folder:        oldParentUID,
			},
		)
	}

	batchResp, err := accessClient.BatchCheck(ctx, user, authlib.BatchCheckRequest{
		Namespace: namespace,
		Checks:    checks,
	})
	if err != nil {
		return err
	}

	writeRes, ok := batchResp.Results[writeDestKey]
	if !ok {
		return fmt.Errorf("access check returned no result for destination write")
	}
	if writeRes.Error != nil {
		return writeRes.Error
	}
	if !writeRes.Allowed {
		destLabel := newParentUID
		if folder.IsRootFolderUID(destLabel) {
			destLabel = folder.GeneralFolderUID
		}
		return folder.ErrMoveAccessDenied.Errorf("user does not have permissions to move a folder to folder with UID %s", destLabel)
	}

	// Fail closed on any missing result — we built every correlation ID
	// ourselves, so an absent key is a server bug.
	newFolder := make(map[string]bool, len(tierProbes))
	oldFolder := make(map[string]bool, len(tierProbes))
	for _, p := range tierProbes {
		nf, nfOk := batchResp.Results[newFolderPrefix+p.suffix]
		of, ofOk := batchResp.Results[oldFolderPrefix+p.suffix]
		if !nfOk || !ofOk {
			return fmt.Errorf("access escalation check returned no result for verb %q", p.verb)
		}
		if nf.Error != nil {
			return nf.Error
		}
		if of.Error != nil {
			return of.Error
		}
		newFolder[p.suffix] = nf.Allowed
		oldFolder[p.suffix] = of.Allowed
	}

	if resolveTier(newFolder) > resolveTier(oldFolder) {
		return folder.ErrAccessEscalation.Errorf("user cannot move a folder to another folder where they have higher permissions")
	}

	return nil
}

// canSkipChildrenCheck determines if we can skip the expensive children depth check.
// If the old parent depth is >= the new parent depth, the folder was already valid
// and this move won't make descendants exceed max depth.
func canSkipChildrenCheck(ctx context.Context, oldFolder utils.GrafanaMetaAccessor, getter rest.Getter, parents parentsGetter, newParentDepth int) bool {
	if folder.IsRootFolderUID(oldFolder.GetFolder()) {
		return false
	}

	oldParentObj, err := getter.Get(ctx, oldFolder.GetFolder(), &metav1.GetOptions{})
	if err != nil {
		return false
	}

	oldParent, ok := oldParentObj.(*folders.Folder)
	if !ok {
		return false
	}

	oldInfo, err := parents(ctx, oldParent)
	if err != nil {
		return false
	}

	oldParentDepth := len(oldInfo.Items)
	levelDifference := newParentDepth - oldParentDepth
	return levelDifference <= 0
}

// checkSubtreeDepth uses a hybrid DFS+batching approach:
// 1. fetches one page of children for the current folder(s)
// 2. batches all those children into one request to get their children
// 3. continues depth-first (batching still) until max depth or violation
// 4. only fetches more siblings after fully exploring current batch
func checkSubtreeDepth(ctx context.Context, searcher resourcepb.ResourceIndexClient, namespace string, folderUID string, remainingDepth int, maxDepth int) error {
	if remainingDepth <= 0 {
		return nil
	}

	// Start with the folder being moved
	return checkSubtreeDepthBatched(ctx, searcher, namespace, []string{folderUID}, remainingDepth, maxDepth)
}

// checkSubtreeDepthBatched checks depth for a batch of folders at the same level
func checkSubtreeDepthBatched(ctx context.Context, searcher resourcepb.ResourceIndexClient, namespace string, parentUIDs []string, remainingDepth int, maxDepth int) error {
	if remainingDepth <= 0 || len(parentUIDs) == 0 {
		return nil
	}

	const pageSize int64 = 1000
	var offset int64
	totalPages := 0
	hasMore := true

	// Using an upper limit to ensure no infinite loops can happen
	for hasMore && totalPages < 1000 {
		totalPages++

		var err error
		var children []string
		children, hasMore, err = getChildrenBatch(ctx, searcher, namespace, parentUIDs, pageSize, offset)
		if err != nil {
			return fmt.Errorf("failed to get children: %w", err)
		}

		if len(children) == 0 {
			return nil
		}

		// if we are at the last allowed depth and children exist, we will hit the max
		if remainingDepth == 1 {
			return folder.ErrMaximumDepthReached.Errorf("maximum folder depth %d would be exceeded after move", maxDepth)
		}

		if err := checkSubtreeDepthBatched(ctx, searcher, namespace, children, remainingDepth-1, maxDepth); err != nil {
			return err
		}

		if !hasMore {
			return nil
		}

		offset += pageSize
	}

	return nil
}

// getChildrenBatch fetches children for multiple parents
func getChildrenBatch(ctx context.Context, searcher resourcepb.ResourceIndexClient, namespace string, parentUIDs []string, limit int64, offset int64) ([]string, bool, error) {
	if len(parentUIDs) == 0 {
		return nil, false, nil
	}

	resp, err := searcher.Search(ctx, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     folders.FolderResourceInfo.GroupVersionResource().Group,
				Resource:  folders.FolderResourceInfo.GroupVersionResource().Resource,
			},
			Fields: []*resourcepb.Requirement{{
				Key:      resource.SEARCH_FIELD_FOLDER,
				Operator: string(selection.In),
				Values:   parentUIDs,
			}},
		},
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, false, fmt.Errorf("failed to search folders: %w", err)
	}

	if resp.Error != nil {
		return nil, false, fmt.Errorf("search error: %s", resp.Error.Message)
	}

	if resp.Results == nil || len(resp.Results.Rows) == 0 {
		return nil, false, nil
	}

	children := make([]string, 0, len(resp.Results.Rows))
	for _, row := range resp.Results.Rows {
		if row.Key != nil {
			children = append(children, row.Key.Name)
		}
	}

	// The bleve Search path populates TotalHits but not Results.NextPageToken, so
	// pagination must be driven off TotalHits + offset rather than the token.
	hasMore := resp.Results.NextPageToken != "" || offset+int64(len(resp.Results.Rows)) < resp.TotalHits
	return children, hasMore, nil
}

func validateOnDelete(ctx context.Context,
	f *folders.Folder,
	searcher resourcepb.ResourceIndexClient,
	deleteOptions *metav1.DeleteOptions,
	cascadeDeleteEnabled bool,
) error {
	// Non-empty folder delete is opt-in via gracePeriodSeconds=0 when kubernetesFolderCascadeDelete
	// is enabled (same pattern as dashboard delete validation). This only bypasses the empty-folder
	// check; until cascade reconciliation runs, child resources are left orphaned.
	if cascadeDeleteEnabled && forceDeleteFromDeleteOptions(deleteOptions) {
		logging.FromContext(ctx).Warn(
			"folder force-delete bypassing empty check; cascade deletion is not yet wired up so sub-folders, dashboards, alert rules, and library elements under this folder will be orphaned. This is a temporary state during the cascade delete rollout.",
			"folder", f.Name,
			"namespace", f.Namespace,
		)
		return nil
	}

	resp, err := searcher.GetStats(ctx, &resourcepb.ResourceStatsRequest{Namespace: f.Namespace, Kinds: countedKinds, Folder: []string{f.Name}})
	if err != nil {
		return err
	}

	if resp != nil && resp.Error != nil {
		return fmt.Errorf("could not verify if folder is empty: %v", resp.Error)
	}

	if resp.Stats == nil {
		return fmt.Errorf("could not verify if folder is empty: %v", resp.Error)
	}

	allowedResourceTypes := []string{"alertrules", "dashboards", "library_elements", "folders"}

	for _, v := range resp.Stats {
		if slices.Contains(allowedResourceTypes, v.Resource) && v.Count > 0 {
			return folder.ErrFolderNotEmpty.Errorf("folder is not empty, contains %d %s", v.Count, v.Resource)
		}
	}
	return nil
}
