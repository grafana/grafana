package folderimpl

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/selection"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"

	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	internalfolders "github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

type FolderUnifiedStoreImpl struct {
	log         log.Logger
	k8sclient   client.K8sHandler
	userService user.Service
}

// sqlStore implements the store interface.
var _ folder.Store = (*FolderUnifiedStoreImpl)(nil)

func ProvideUnifiedStore(k8sHandler client.K8sHandler, userService user.Service) *FolderUnifiedStoreImpl {
	return &FolderUnifiedStoreImpl{
		k8sclient:   k8sHandler,
		log:         log.New("folder-store"),
		userService: userService,
	}
}

func (ss *FolderUnifiedStoreImpl) Create(ctx context.Context, cmd folder.CreateFolderCommand) (*folder.Folder, error) {
	obj, err := internalfolders.LegacyCreateCommandToUnstructured(&cmd)
	if err != nil {
		return nil, err
	}
	out, err := ss.k8sclient.Create(ctx, obj, cmd.OrgID)
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
	for _, uid := range UIDs {
		err := ss.k8sclient.Delete(ctx, uid, orgID, v1.DeleteOptions{})
		if err != nil {
			return err
		}
	}

	return nil
}

func (ss *FolderUnifiedStoreImpl) Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {
	obj, err := ss.k8sclient.Get(ctx, cmd.UID, cmd.OrgID, v1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, dashboards.ErrFolderNotFound
		}

		return nil, err
	}
	updated := obj.DeepCopy()

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
		meta, err := utils.MetaAccessor(updated)
		if err != nil {
			return nil, err
		}
		meta.SetFolder(*cmd.NewParentUID)
	}

	out, err := ss.k8sclient.Update(ctx, updated, cmd.OrgID)
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
	out, err := ss.k8sclient.Get(ctx, *q.UID, q.OrgID, v1.GetOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return nil, err
	} else if err != nil || out == nil {
		return nil, dashboards.ErrFolderNotFound
	}

	return ss.UnstructuredToLegacyFolder(ctx, out)
}

func (ss *FolderUnifiedStoreImpl) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	hits := []*folder.Folder{}

	parentUid := q.UID

	for parentUid != "" {
		folder, err := ss.Get(ctx, folder.GetFolderQuery{UID: &parentUid, OrgID: q.OrgID})
		if err != nil {
			var statusError *apierrors.StatusError
			if errors.As(err, &statusError) && statusError.ErrStatus.Code == http.StatusForbidden {
				// If we get a Forbidden error when requesting the parent folder, it means the user does not have access
				// to it, nor its parents. So we can stop looping
				break
			}
			return nil, err
		}

		parentUid = folder.ParentUID
		hits = append(hits, folder)
	}

	if len(hits) > 0 {
		return util.Reverse(hits[1:]), nil
	}

	return hits, nil
}

func (ss *FolderUnifiedStoreImpl) GetChildren(ctx context.Context, q folder.GetChildrenQuery) ([]*folder.FolderReference, error) {
	// the general folder is saved as an empty string in the database
	if q.UID == folder.GeneralFolderUID {
		q.UID = ""
	}
	if q.Limit == 0 {
		q.Limit = folderSearchLimit
	}
	if q.Page == 0 {
		q.Page = 1
	}

	if q.UID != "" {
		// the original get children query fails if the parent folder does not exist
		// check that the parent exists first
		_, err := ss.Get(ctx, folder.GetFolderQuery{UID: &q.UID, OrgID: q.OrgID})
		if err != nil {
			return nil, err
		}
	}

	req := &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Fields: []*resource.Requirement{
				{
					Key:      resource.SEARCH_FIELD_FOLDER,
					Operator: string(selection.In),
					Values:   []string{q.UID},
				},
			},
		},
		Limit: q.Limit,
		// legacy fallback search requires page, unistore requires offset,
		// so set both
		Offset: q.Limit * (q.Page - 1),
		Page:   q.Page,
	}

	// only filter the folder UIDs if they are provided in the query
	if len(q.FolderUIDs) > 0 {
		req.Options.Fields = append(req.Options.Fields, &resource.Requirement{
			Key:      resource.SEARCH_FIELD_NAME,
			Operator: string(selection.In),
			Values:   q.FolderUIDs,
		})
	}

	// now, get children of the parent folder
	out, err := ss.k8sclient.Search(ctx, q.OrgID, req)
	if err != nil {
		return nil, err
	}

	res, err := dashboardsearch.ParseResults(out, 0)
	if err != nil {
		return nil, err
	}

	allowK6Folder := (q.SignedInUser != nil && q.SignedInUser.IsIdentityType(claims.TypeServiceAccount))
	hits := make([]*folder.FolderReference, 0)
	for _, item := range res.Hits {
		// filter out k6 folders if request is not from a service account
		if item.Name == accesscontrol.K6FolderUID && !allowK6Folder {
			continue
		}

		f := &folder.FolderReference{
			ID:        item.Field.GetNestedInt64(resource.SEARCH_FIELD_LEGACY_ID),
			UID:       item.Name,
			Title:     item.Title,
			ParentUID: item.Folder,
		}

		if item.Field.GetNestedString(resource.SEARCH_FIELD_MANAGER_KIND) != "" {
			f.ManagedBy = utils.ParseManagerKindString(item.Field.GetNestedString(resource.SEARCH_FIELD_MANAGER_KIND))
		}

		hits = append(hits, f)
	}

	return hits, nil
}

// TODO use a single query to get the height of a folder
func (ss *FolderUnifiedStoreImpl) GetHeight(ctx context.Context, foldrUID string, orgID int64, parentUID *string) (int, error) {
	height := -1
	queue := []string{foldrUID}
	for len(queue) > 0 && height <= folder.MaxNestedFolderDepth {
		length := len(queue)
		height++
		for i := 0; i < length; i++ {
			ele := queue[0]
			queue = queue[1:]
			if parentUID != nil && *parentUID == ele {
				return 0, folder.ErrCircularReference
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
	if height > folder.MaxNestedFolderDepth {
		ss.log.Warn("folder height exceeds the maximum allowed depth, You might have a circular reference", "uid", foldrUID, "orgId", orgID, "maxDepth", folder.MaxNestedFolderDepth)
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
	opts := v1.ListOptions{}
	if q.WithFullpath || q.WithFullpathUIDs {
		// only supported in modes 0-2, to keep the alerting queries from causing tons of get folder requests
		// to retrieve the parent for all folders in grafana
		opts.LabelSelector = utils.LabelGetFullpath + "=true"
	}

	out, err := ss.k8sclient.List(ctx, q.OrgID, opts)
	if err != nil {
		return nil, err
	}
	// convert item to legacy folder format
	folders, err := ss.UnstructuredToLegacyFolderList(ctx, out)
	if err != nil {
		return nil, err
	}

	m := map[string]*folder.Folder{}
	for _, f := range folders {
		if (q.WithFullpath || q.WithFullpathUIDs) && f.Fullpath == "" {
			parents, err := ss.GetParents(ctx, folder.GetParentsQuery{UID: f.UID, OrgID: q.OrgID})
			if err != nil {
				return nil, fmt.Errorf("failed to get parents for folder %s: %w", f.UID, err)
			}
			// If we don't have a parent, we just return the current folder as the full path
			f.Fullpath, f.FullpathUIDs = computeFullPath(append(parents, f))
		}

		m[f.UID] = f
	}

	hits := []*folder.Folder{}

	if len(q.UIDs) > 0 {
		//return only the specified q.UIDs
		for _, uid := range q.UIDs {
			f, ok := m[uid]
			if ok {
				hits = append(hits, f)
			}
		}

		return hits, nil
	}

	/*
		if len(q.AncestorUIDs) > 0 {
			// TODO
			//return all nodes under those ancestors, requires building a tree
		}
	*/

	//return everything
	for _, f := range m {
		hits = append(hits, f)
	}

	return hits, nil
}

func (ss *FolderUnifiedStoreImpl) GetDescendants(ctx context.Context, orgID int64, ancestor_uid string) ([]*folder.Folder, error) {
	out, err := ss.k8sclient.List(ctx, orgID, v1.ListOptions{})
	if err != nil {
		return nil, err
	}

	// convert item to legacy folder format
	folders, err := ss.UnstructuredToLegacyFolderList(ctx, out)
	if err != nil {
		return nil, err
	}

	nodes := map[string]*folder.Folder{}
	for _, f := range folders {
		nodes[f.UID] = f
	}

	tree := map[string]map[string]*folder.Folder{}

	for uid, f := range nodes {
		parentUID := f.ParentUID
		if parentUID == "" {
			parentUID = "general"
		}

		if tree[parentUID] == nil {
			tree[parentUID] = map[string]*folder.Folder{}
		}

		tree[parentUID][uid] = f
	}

	descendantsMap := map[string]*folder.Folder{}
	getDescendants(nodes, tree, ancestor_uid, descendantsMap)

	descendants := []*folder.Folder{}
	for _, f := range descendantsMap {
		descendants = append(descendants, f)
	}

	return descendants, nil
}

func getDescendants(nodes map[string]*folder.Folder, tree map[string]map[string]*folder.Folder, ancestor_uid string, descendantsMap map[string]*folder.Folder) {
	for uid := range tree[ancestor_uid] {
		descendantsMap[uid] = nodes[uid]
		getDescendants(nodes, tree, uid, descendantsMap)
	}
}

func (ss *FolderUnifiedStoreImpl) CountFolderContent(ctx context.Context, orgID int64, ancestor_uid string) (folder.DescendantCounts, error) {
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

func toFolderLegacyCounts(u *unstructured.Unstructured) (*folder.DescendantCounts, error) {
	ds, err := v0alpha1.UnstructuredToDescendantCounts(u)
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
