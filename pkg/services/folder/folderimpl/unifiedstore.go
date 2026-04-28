package folderimpl

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/selection"

	claims "github.com/grafana/authlib/types"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	internalfolders "github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util"
)

const tracePrefix = "folder.unifiedstore."

type FolderUnifiedStoreImpl struct {
	log         log.Logger
	k8sclient   client.K8sHandler
	userService user.Service
	tracer      trace.Tracer
	maxDepth    int
}

// sqlStore implements the store interface.
var _ folder.Store = (*FolderUnifiedStoreImpl)(nil)

func ProvideUnifiedStore(k8sHandler client.K8sHandler, userService user.Service, tracer trace.Tracer, cfg *setting.Cfg) *FolderUnifiedStoreImpl {
	return &FolderUnifiedStoreImpl{
		k8sclient:   k8sHandler,
		log:         log.New("folder-store"),
		userService: userService,
		tracer:      tracer,
		maxDepth:    cfg.MaxNestedFolderDepth,
	}
}

func (ss *FolderUnifiedStoreImpl) Create(ctx context.Context, cmd folder.CreateFolderCommand) (*folder.Folder, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"Create")
	defer span.End()

	obj, err := internalfolders.LegacyCreateCommandToUnstructured(&cmd)
	if err != nil {
		return nil, err
	}
	out, err := ss.k8sclient.Create(ctx, obj, cmd.OrgID, v1.CreateOptions{
		FieldValidation: v1.FieldValidationIgnore})
	if err != nil {
		return nil, err
	}

	folder, err := ss.UnstructuredToLegacyFolder(ctx, out)
	if err != nil {
		return nil, err
	}

	return folder, err
}

func (ss *FolderUnifiedStoreImpl) Delete(ctx context.Context, UIDs []string, orgID int64) error {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"Delete")
	defer span.End()

	for _, uid := range UIDs {
		err := ss.k8sclient.Delete(ctx, uid, orgID, v1.DeleteOptions{})
		if err != nil {
			return err
		}
	}

	return nil
}

func (ss *FolderUnifiedStoreImpl) Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"Update")
	defer span.End()

	obj, err := ss.k8sclient.Get(ctx, cmd.UID, cmd.OrgID, v1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, dashboards.ErrFolderNotFound
		}

		return nil, err
	}
	updated := obj.DeepCopy()
	meta, err := utils.MetaAccessor(updated)
	if err != nil {
		return nil, err
	}

	if cmd.NewTitle != nil {
		err = unstructured.SetNestedField(updated.Object, *cmd.NewTitle, "spec", "title")
		if err != nil {
			return nil, err
		}
	}
	if cmd.NewDescription != nil {
		err = unstructured.SetNestedField(updated.Object, *cmd.NewDescription, "spec", "description")
		if err != nil {
			return nil, err
		}
	}
	if cmd.NewParentUID != nil {
		meta.SetFolder(*cmd.NewParentUID)
	} else {
		// only compare versions if not moving the folder
		if !cmd.Overwrite && (cmd.Version != int(obj.GetGeneration())) {
			return nil, dashboards.ErrDashboardVersionMismatch
		}
	}

	// nolint:staticcheck
	if cmd.ManagerKindClassicFP != "" {
		meta.SetManagerProperties(utils.ManagerProperties{
			Kind:     utils.ManagerKindClassicFP,
			Identity: cmd.ManagerKindClassicFP,
		})
	}

	out, err := ss.k8sclient.Update(ctx, updated, cmd.OrgID, v1.UpdateOptions{
		FieldValidation: v1.FieldValidationIgnore,
	})
	if err != nil {
		return nil, err
	}

	return ss.UnstructuredToLegacyFolder(ctx, out)
}

// If WithFullpath is true it computes also the full path of a folder.
// The full path is a string that contains the titles of all parent folders separated by a slash.
// For example, if the folder structure is:
//
//	A
//	└── B
//	    └── C
//
// The full path of C is "A/B/C".
// The full path of B is "A/B".
// The full path of A is "A".
// If a folder contains a slash in its title, it is escaped with a backslash.
// For example, if the folder structure is:
//
//	A
//	└── B/C
//
// The full path of C is "A/B\/C".
func (ss *FolderUnifiedStoreImpl) Get(ctx context.Context, q folder.GetFolderQuery) (*folder.Folder, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"Get")
	defer span.End()

	out, err := ss.k8sclient.Get(ctx, *q.UID, q.OrgID, v1.GetOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return nil, err
	} else if err != nil || out == nil {
		return nil, dashboards.ErrFolderNotFound
	}

	return ss.UnstructuredToLegacyFolder(ctx, out)
}

func (ss *FolderUnifiedStoreImpl) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"GetParents")
	defer span.End()

	hits := []*folder.Folder{}

	parentUID := q.UID
	for parentUID != "" {
		folder, err := ss.Get(ctx, folder.GetFolderQuery{UID: &parentUID, OrgID: q.OrgID})
		if err != nil {
			if apierrors.IsForbidden(err) {
				// If we get a Forbidden error when requesting the parent folder, it means the user does not have access
				// to it, nor its parents. So we can stop looping
				break
			}
			return nil, err
		}

		parentUID = folder.ParentUID
		hits = append(hits, folder)
	}

	if len(hits) == 0 {
		return hits, nil
	}

	return util.Reverse(hits[1:]), nil
}

func (ss *FolderUnifiedStoreImpl) GetChildren(ctx context.Context, q folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"GetChildren")
	defer span.End()

	// the general folder is saved as an empty string in the database
	if q.UID == folder.GeneralFolderUID {
		q.UID = ""
	}

	if q.UID != "" {
		// the original get children query fails if the parent folder does not exist
		// check that the parent exists first
		_, err := ss.Get(ctx, folder.GetFolderQuery{UID: &q.UID, OrgID: q.OrgID})
		if err != nil {
			return nil, err
		}
	}

	return ss.searchChildren(ctx, []string{q.UID}, q)
}

// searchChildren returns the direct children of any of the given parent UIDs
// via k8sclient.Search (multi-value `In` filter on the folder field). It does
// not validate that the parents exist; the caller is responsible.
//
// Honours q.Limit as the total cap on returned hits and q.Page as the
// starting offset (offset = q.Limit * (q.Page - 1)). Internally the fetch is
// split into pages of at most searchPageSize hits to stay under the default
// 4 MiB gRPC max receive size. Pagination uses Offset only; folders only hit
// the unified bleve backend, which honours Offset and ignores Page.
func (ss *FolderUnifiedStoreImpl) searchChildren(ctx context.Context, parents []string, q folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"searchChildren")
	defer span.End()

	if q.Limit == 0 {
		q.Limit = folderSearchLimit
	}
	if q.Page == 0 {
		q.Page = 1
	}

	fields := []*resourcepb.Requirement{{
		Key:      resource.SEARCH_FIELD_FOLDER,
		Operator: string(selection.In),
		Values:   parents,
	}}

	// only filter the folder UIDs if they are provided in the query
	if len(q.FolderUIDs) > 0 {
		fields = append(fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_NAME,
			Operator: string(selection.In),
			Values:   q.FolderUIDs,
		})
	}

	// Exclude k6 folder at the query level. The unified/bleve search backend
	// honours NotIn, so this is sufficient.
	allowK6Folder := q.SignedInUser != nil && q.SignedInUser.IsIdentityType(claims.TypeServiceAccount)
	if !allowK6Folder {
		fields = append(fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_NAME,
			Operator: string(selection.NotIn),
			Values:   []string{accesscontrol.K6FolderUID},
		})
	}

	startOffset := q.Limit * (q.Page - 1)
	var hits []*folder.FolderReference
	for fetched := int64(0); fetched < q.Limit; {
		pageSize := min(q.Limit-fetched, int64(searchPageSize))
		req := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{Fields: fields},
			Limit:   pageSize,
			Offset:  startOffset + fetched,
		}

		out, err := ss.k8sclient.Search(ctx, q.OrgID, req)
		if err != nil {
			return nil, err
		}

		res, err := dashboardsearch.ParseResults(out, 0)
		if err != nil {
			return nil, err
		}

		for _, item := range res.Hits {
			hits = append(hits, &folder.FolderReference{
				ID:        item.Field.GetNestedInt64(resource.SEARCH_FIELD_LEGACY_ID),
				UID:       item.Name,
				Title:     item.Title,
				ParentUID: item.Folder,
				ManagedBy: item.ManagedBy.Kind,
			})
		}

		raw := int64(len(res.Hits))
		fetched += raw
		if raw < pageSize {
			break
		}
	}

	return hits, nil
}

// TODO use a single query to get the height of a folder
// TODO: unused, remove.
func (ss *FolderUnifiedStoreImpl) GetHeight(ctx context.Context, foldrUID string, orgID int64, parentUID *string) (int, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"GetHeight")
	defer span.End()

	height := -1
	queue := []string{foldrUID}
	for len(queue) > 0 && height <= ss.maxDepth {
		length := len(queue)
		height++
		for i := 0; i < length; i++ {
			ele := queue[0]
			queue = queue[1:]
			if parentUID != nil && *parentUID == ele {
				return 0, folder.ErrCircularReference.Errorf("circular reference detected")
			}
			folders, err := ss.GetChildren(ctx, folder.GetChildrenQuery{UID: ele, OrgID: orgID})
			if err != nil {
				return 0, err
			}
			for _, f := range folders {
				queue = append(queue, f.UID)
			}
		}
	}
	if height > ss.maxDepth {
		ss.log.Warn("folder height exceeds the maximum allowed depth, You might have a circular reference", "uid", foldrUID, "orgId", orgID, "maxDepth", ss.maxDepth)
	}
	return height, nil
}

// GetFolders returns org folders by their UIDs.
// If UIDs is empty, it returns all folders in the org.
// If WithFullpath is true it computes also the full path of a folder.
// The full path is a string that contains the titles of all parent folders separated by a slash.
// For example, if the folder structure is:
//
//	A
//	└── B
//	    └── C
//
// The full path of C is "A/B/C".
// The full path of B is "A/B".
// The full path of A is "A".
// If a folder contains a slash in its title, it is escaped with a backslash.
// For example, if the folder structure is:
//
//	A
//	└── B/C
//
// The full path of C is "A/B\/C".
//
// If FullpathUIDs is true it computes a string that contains the UIDs of all parent folders separated by slash.
// For example, if the folder structure is:
//
//	A (uid: "uid1")
//	└── B (uid: "uid2")
//	    └── C (uid: "uid3")
//
// The full path UIDs of C is "uid1/uid2/uid3".
// The full path UIDs of B is "uid1/uid2".
// The full path UIDs of A is "uid1".
func (ss *FolderUnifiedStoreImpl) GetFolders(ctx context.Context, q folder.GetFoldersFromStoreQuery) ([]*folder.Folder, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"GetFolders")
	defer span.End()

	out, err := ss.list(ctx, q.OrgID, v1.ListOptions{})
	if err != nil {
		return nil, err
	}
	// convert item to legacy folder format
	folders, err := ss.UnstructuredToLegacyFolderList(ctx, out)
	if err != nil {
		return nil, err
	}

	filters := make(map[string]struct{}, len(q.UIDs))
	for _, uid := range q.UIDs {
		filters[uid] = struct{}{}
	}

	folderMap := make(map[string]*folder.Folder)
	relations := make(map[string]string)
	if q.WithFullpath || q.WithFullpathUIDs {
		for _, folder := range folders {
			folderMap[folder.UID] = folder
			relations[folder.UID] = folder.ParentUID
		}
	}

	hits := make([]*folder.Folder, 0, len(folders))
	for _, f := range folders {
		if shouldSkipFolder(f, filters) {
			continue
		}

		if (q.WithFullpath || q.WithFullpathUIDs) && f.Fullpath == "" {
			if err := buildFolderFullPaths(f, relations, folderMap); err != nil {
				return nil, err
			}
		}

		hits = append(hits, f)
	}

	// TODO: return all nodes under those ancestors, requires building a tree
	// if len(q.AncestorUIDs) > 0 {
	// }

	return hits, nil
}

// GetDescendants returns all descendants of ancestorUID by walking the tree
// level by level via k8sclient.Search, batching up to descendantsBatchSize
// parents into each Search call via a multi-value `In` filter. Cost scales
// with subtree size, not org size.
//
// The returned folders are minimal: only UID, ID, OrgID, ParentUID, Title and
// ManagedBy are populated (the fields available on folder.FolderReference).
// Callers needing fuller folders (Created, Updated, Description, ...) should
// pass the returned UIDs to GetFolders.
//
// The traversal is bounded by ss.maxDepth. If the bound is exceeded a warning
// is logged and the partial result is returned.
func (ss *FolderUnifiedStoreImpl) GetDescendants(ctx context.Context, orgID int64, ancestorUID string) ([]*folder.Folder, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"GetDescendants")
	defer span.End()

	// Validate the ancestor exists once. Without this we could not distinguish
	// "not found" from "found but has no children".
	if _, err := ss.Get(ctx, folder.GetFolderQuery{UID: &ancestorUID, OrgID: orgID}); err != nil {
		return nil, err
	}

	var out []*folder.Folder
	queue := []string{ancestorUID}
	visited := map[string]bool{ancestorUID: true}
	// Mirrors the loop shape of GetHeight: depth starts at -1 and is
	// incremented before each level is processed. After the loop, depth
	// equals the deepest level reached; depth > maxDepth means we hit the
	// cap with items still queued.
	depth := -1
	for len(queue) > 0 && depth <= ss.maxDepth {
		depth++
		level := queue
		queue = nil // next level fills here
		for chunk := range slices.Chunk(level, descendantsBatchSize) {
			children, err := ss.searchChildren(ctx, chunk, folder.GetChildrenQuery{OrgID: orgID})
			if err != nil {
				return nil, err
			}
			for _, ref := range children {
				if visited[ref.UID] {
					return nil, folder.ErrCircularReference.Errorf("circular reference detected at folder uid: %s", ref.UID)
				}
				visited[ref.UID] = true
				out = append(out, &folder.Folder{
					ID:        ref.ID, // nolint:staticcheck
					OrgID:     orgID,
					UID:       ref.UID,
					ParentUID: ref.ParentUID,
					Title:     ref.Title,
					ManagedBy: ref.ManagedBy,
				})
				queue = append(queue, ref.UID)
			}
		}
	}
	if depth > ss.maxDepth {
		ss.log.Warn("folder depth exceeds the maximum allowed depth, you might have a circular reference",
			"uid", ancestorUID, "orgId", orgID, "maxDepth", ss.maxDepth)
	}
	return out, nil
}

func (ss *FolderUnifiedStoreImpl) CountFolderContent(ctx context.Context, orgID int64, ancestor_uid string) (folder.DescendantCounts, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"CountFolderContent")
	defer span.End()

	counts, err := ss.k8sclient.Get(ctx, ancestor_uid, orgID, v1.GetOptions{}, "counts")
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, dashboards.ErrFolderNotFound
		}

		return nil, err
	}

	res, err := toFolderLegacyCounts(counts)
	return *res, err
}

func (ss *FolderUnifiedStoreImpl) CountInOrg(ctx context.Context, orgID int64) (int64, error) {
	resp, err := ss.k8sclient.GetStats(ctx, orgID)
	if err != nil {
		return 0, err
	}

	if len(resp.Stats) != 1 {
		return 0, fmt.Errorf("expected 1 stat, got %d", len(resp.Stats))
	}

	return resp.Stats[0].Count, nil
}

func (ss *FolderUnifiedStoreImpl) list(ctx context.Context, orgID int64, opts v1.ListOptions) (*unstructured.UnstructuredList, error) {
	ctx, span := ss.tracer.Start(ctx, tracePrefix+"list")
	defer span.End()

	var allItems []unstructured.Unstructured

	listOpts := opts.DeepCopy()

	if listOpts.Limit == 0 {
		listOpts.Limit = folderListLimit
	}

	for {
		out, err := ss.k8sclient.List(ctx, orgID, *listOpts)
		if err != nil {
			return nil, err
		}

		if out == nil {
			return nil, fmt.Errorf("k8s folder list returned nil")
		}

		if len(out.Items) > 0 {
			allItems = append(allItems, out.Items...)
		}

		if out.GetContinue() == "" || (opts.Limit > 0 && int64(len(allItems)) >= opts.Limit) {
			break
		}

		listOpts.Continue = out.GetContinue()
	}

	result := &unstructured.UnstructuredList{
		Items: allItems,
	}

	if opts.Limit > 0 && int64(len(allItems)) > opts.Limit {
		result.Items = allItems[:opts.Limit]
	}

	return result, nil
}

func toFolderLegacyCounts(u *unstructured.Unstructured) (*folder.DescendantCounts, error) {
	ds, err := folderv1.UnstructuredToDescendantCounts(u)
	if err != nil {
		return nil, err
	}

	var out = make(folder.DescendantCounts)
	for _, v := range ds.Counts {
		// if stats come from unified storage, we will use them
		if v.Group != "sql-fallback" {
			out[v.Resource] = v.Count
			continue
		}
		// if stats are from single tenant DB and they are not in unified storage, we will use them
		if _, ok := out[v.Resource]; !ok {
			out[v.Resource] = v.Count
		}
	}
	return &out, nil
}

func computeFullPath(parents []*folder.Folder) (string, string) {
	fullpath := make([]string, len(parents))
	fullpathUIDs := make([]string, len(parents))
	for i, p := range parents {
		fullpath[i] = p.Title
		fullpathUIDs[i] = p.UID
	}
	return strings.Join(fullpath, "/"), strings.Join(fullpathUIDs, "/")
}

func buildFolderFullPaths(f *folder.Folder, relations map[string]string, folderMap map[string]*folder.Folder) error {
	titles := make([]string, 0)
	uids := make([]string, 0)

	titles = append(titles, f.Title)
	uids = append(uids, f.UID)

	seen := make(map[string]bool)
	currentUID := f.UID
	for currentUID != "" {
		if seen[currentUID] {
			return folder.ErrCircularReference.Errorf("circular reference detected for folder %s", currentUID)
		}
		seen[currentUID] = true
		parentUID, exists := relations[currentUID]
		if !exists {
			break
		}

		if parentUID == "" {
			break
		}

		parentFolder, exists := folderMap[parentUID]
		if !exists {
			break
		}
		titles = append(titles, parentFolder.Title)
		uids = append(uids, parentFolder.UID)
		currentUID = parentFolder.UID
	}

	f.Fullpath = strings.Join(util.Reverse(titles), "/")
	f.FullpathUIDs = strings.Join(util.Reverse(uids), "/")
	return nil
}

func shouldSkipFolder(f *folder.Folder, filterUIDs map[string]struct{}) bool {
	if len(filterUIDs) == 0 {
		return false
	}
	_, exists := filterUIDs[f.UID]
	return !exists
}
