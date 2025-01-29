package folderimpl

import (
	"context"
	"fmt"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	k8sUser "k8s.io/apiserver/pkg/authentication/user"
	k8sRequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"

	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	internalfolders "github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

type FolderUnifiedStoreImpl struct {
	log         log.Logger
	k8sclient   folderK8sHandler
	userService user.Service
}

// sqlStore implements the store interface.
var _ folder.Store = (*FolderUnifiedStoreImpl)(nil)

func ProvideUnifiedStore(k8sHandler *foldk8sHandler, userService user.Service) *FolderUnifiedStoreImpl {
	return &FolderUnifiedStoreImpl{
		k8sclient:   k8sHandler,
		log:         log.New("folder-store"),
		userService: userService,
	}
}

func (ss *FolderUnifiedStoreImpl) Create(ctx context.Context, cmd folder.CreateFolderCommand) (*folder.Folder, error) {
	newCtx, cancel, err := ss.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := ss.k8sclient.getClient(newCtx, cmd.OrgID)
	if !ok {
		return nil, nil
	}

	obj, err := internalfolders.LegacyCreateCommandToUnstructured(&cmd)
	if err != nil {
		return nil, err
	}
	out, err := client.Create(newCtx, obj, v1.CreateOptions{})
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
	newCtx, cancel, err := ss.getK8sContext(ctx)
	if err != nil {
		return err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := ss.k8sclient.getClient(newCtx, orgID)
	if !ok {
		return nil
	}

	for _, uid := range UIDs {
		err = client.Delete(newCtx, uid, v1.DeleteOptions{})
		if err != nil {
			return err
		}
	}

	return nil
}

func (ss *FolderUnifiedStoreImpl) Update(ctx context.Context, cmd folder.UpdateFolderCommand) (*folder.Folder, error) {
	newCtx, cancel, err := ss.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := ss.k8sclient.getClient(newCtx, cmd.OrgID)
	if !ok {
		return nil, nil
	}

	obj, err := client.Get(ctx, cmd.UID, v1.GetOptions{})
	if err != nil {
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

	out, err := client.Update(ctx, updated, v1.UpdateOptions{})
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
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := ss.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := ss.k8sclient.getClient(newCtx, q.OrgID)
	if !ok {
		return nil, nil
	}

	out, err := client.Get(newCtx, *q.UID, v1.GetOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return nil, err
	} else if err != nil || out == nil {
		return nil, dashboards.ErrFolderNotFound
	}

	return ss.UnstructuredToLegacyFolder(ctx, out)
}

func (ss *FolderUnifiedStoreImpl) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := ss.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := ss.k8sclient.getClient(newCtx, q.OrgID)
	if !ok {
		return nil, nil
	}

	hits := []*folder.Folder{}

	parentUid := q.UID

	for parentUid != "" {
		out, err := client.Get(newCtx, parentUid, v1.GetOptions{})
		if err != nil {
			return nil, err
		}

		folder, err := ss.UnstructuredToLegacyFolder(ctx, out)
		if err != nil {
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

func (ss *FolderUnifiedStoreImpl) GetChildren(ctx context.Context, q folder.GetChildrenQuery) ([]*folder.Folder, error) {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := ss.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := ss.k8sclient.getClient(newCtx, q.OrgID)
	if !ok {
		return nil, nil
	}

	out, err := client.List(newCtx, v1.ListOptions{})
	if err != nil {
		return nil, err
	}

	hits := make([]*folder.Folder, 0)
	for _, item := range out.Items {
		// convert item to legacy folder format
		f, err := ss.UnstructuredToLegacyFolder(ctx, &item)
		if f == nil {
			return nil, fmt.Errorf("unable to convert unstructured item to legacy folder %w", err)
		}

		// it we are at root level, skip subfolder
		if q.UID == "" && f.ParentUID != "" {
			continue // query filter
		}
		// if we are at a nested folder, then skip folders that don't belong to parentUid
		if q.UID != "" && !strings.EqualFold(f.ParentUID, q.UID) {
			continue
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
	newCtx, cancel, err := ss.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := ss.k8sclient.getClient(newCtx, q.OrgID)
	if !ok {
		return nil, nil
	}

	out, err := client.List(newCtx, v1.ListOptions{})
	if err != nil {
		return nil, err
	}

	m := map[string]*folder.Folder{}
	for _, item := range out.Items {
		// convert item to legacy folder format
		f, err := ss.UnstructuredToLegacyFolder(ctx, &item)
		if f == nil {
			return nil, fmt.Errorf("unable to convert unstructured item to legacy folder %w", err)
		}
		if q.WithFullpath || q.WithFullpathUIDs {
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
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := ss.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := ss.k8sclient.getClient(newCtx, orgID)
	if !ok {
		return nil, nil
	}

	out, err := client.List(newCtx, v1.ListOptions{})
	if err != nil {
		return nil, err
	}

	nodes := map[string]*folder.Folder{}
	for _, item := range out.Items {
		// convert item to legacy folder format
		f, err := ss.UnstructuredToLegacyFolder(ctx, &item)
		if f == nil {
			return nil, fmt.Errorf("unable to convert unstructured item to legacy folder %w", err)
		}

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
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := ss.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := ss.k8sclient.getClient(newCtx, orgID)
	if !ok {
		return nil, nil
	}

	counts, err := client.Get(newCtx, ancestor_uid, v1.GetOptions{}, "counts")
	if err != nil {
		return nil, err
	}

	res, err := toFolderLegacyCounts(counts)
	return *res, err
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

func (ss *FolderUnifiedStoreImpl) getK8sContext(ctx context.Context) (context.Context, context.CancelFunc, error) {
	requester, requesterErr := identity.GetRequester(ctx)
	if requesterErr != nil {
		return nil, nil, requesterErr
	}

	user, exists := k8sRequest.UserFrom(ctx)
	if !exists {
		// add in k8s user if not there yet
		var ok bool
		user, ok = requester.(k8sUser.Info)
		if !ok {
			return nil, nil, fmt.Errorf("could not convert user to k8s user")
		}
	}

	newCtx := k8sRequest.WithUser(context.Background(), user)
	newCtx = log.WithContextualAttributes(newCtx, log.FromContext(ctx))
	// TODO: after GLSA token workflow is removed, make this return early
	// and move the else below to be unconditional
	if requesterErr == nil {
		newCtxWithRequester := identity.WithRequester(newCtx, requester)
		newCtx = newCtxWithRequester
	}

	// inherit the deadline from the original context, if it exists
	deadline, ok := ctx.Deadline()
	if ok {
		var newCancel context.CancelFunc
		newCtx, newCancel = context.WithTimeout(newCtx, time.Until(deadline))
		return newCtx, newCancel, nil
	}

	return newCtx, nil, nil
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
