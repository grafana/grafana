package folderimpl

import (
	"context"
	"fmt"
	"strings"
	"time"

	"golang.org/x/exp/slices"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8sUser "k8s.io/apiserver/pkg/authentication/user"
	k8sRequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	internalfolders "github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// interface to allow for testing
type folderK8sHandler interface {
	getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool)
	getNamespace(orgID int64) string
}

var _ folderK8sHandler = (*foldk8sHandler)(nil)

type foldk8sHandler struct {
	cfg        *setting.Cfg
	namespacer request.NamespaceMapper
	gvr        schema.GroupVersionResource
}

/*
type GetFoldersFromStoreQuery struct {
	GetFoldersQuery
	AncestorUIDs []string
}

type GetFoldersQuery struct {
	OrgID            int64
	UIDs             []string
	WithFullpath     bool
	WithFullpathUIDs bool
	BatchSize        uint64

	// OrderByTitle is used to sort the folders by title
	// Set to true when ordering is meaningful (used for listing folders)
	// otherwise better to keep it false since ordering can have a performance impact
	OrderByTitle bool
	SignedInUser identity.Requester `json:"-"`
}
*/

func (s *Service) getFoldersV2(ctx context.Context, q folder.GetFoldersFromStoreQuery) ([]*folder.Folder, error) {
	newCtx, cancel, err := s.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := s.k8sclient.getClient(newCtx, q.OrgID)
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
		f, _ := internalfolders.UnstructuredToLegacyFolder(item, q.SignedInUser.GetOrgID())
		if f == nil {
			return nil, fmt.Errorf("unable covert unstructured item to legacy folder")
		}

		m[f.UID] = f
	}

	hits := []*folder.Folder{}

	if len(q.UIDs) > 0 {
		//return only the specified q.UIDs
		for _, uid := range q.UIDs {
			hits = append(hits, m[uid])
		}

		return hits, nil
	}

	if len(q.AncestorUIDs) > 0 {
		// TODO
		//return all nodes under those ancestors, requires building a tree
	}

	//return everything
	for _, f := range m {
		hits = append(hits, f)
	}

	return hits, nil
}

// NOTE: the current implementation is temporary and it will be
// replaced by a proper indexing service/search API
// Also, the current implementation does not support pagination
func (s *Service) GetFoldersFromApiServer(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	if q.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}
	ctx = identity.WithRequester(ctx, q.SignedInUser)

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

	dashFolders, err := s.getFoldersV2(ctx, qry)
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch subfolders: %w", err)
	}

	return dashFolders, nil
	/*
		// create a new context - prevents issues when the request stems from the k8s api itself
		// otherwise the context goes through the handlers twice and causes issues
		newCtx, cancel, err := s.getK8sContext(ctx)
		if err != nil {
			return nil, err
		} else if cancel != nil {
			defer cancel()
		}

		client, ok := s.k8sclient.getClient(newCtx, q.OrgID)
		if !ok {
			return nil, nil
		}

		out, err := client.List(newCtx, v1.ListOptions{})
		if err != nil {
			return nil, err
		}

		// build map of uids
		uidsSet := map[string]struct{}{}
		for _, uid := range q.UIDs {
			uidsSet[uid] = struct{}{}
		}

		hits := make([]*folder.Folder, 0)
		for _, item := range out.Items {
			// convert item to legacy folder format
			f, _ := internalfolders.UnstructuredToLegacyFolder(item, q.SignedInUser.GetOrgID())
			if f == nil {
				return nil, fmt.Errorf("unable covert unstructured item to legacy folder")
			}

			_, ok := uidsSet[f.UID]
			if len(uidsSet) > 0 && !ok {
				continue
			}

			hits = append(hits, f)
		}

		return hits, nil
	*/
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

	var dashFolder *folder.Folder

	switch {
	case q.UID != nil:
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Folder).Inc()

		// create a new context - prevents issues when the request stems from the k8s api itself
		// otherwise the context goes through the handlers twice and causes issues
		newCtx, cancel, err := s.getK8sContext(ctx)
		if err != nil {
			return nil, err
		} else if cancel != nil {
			defer cancel()
		}

		client, ok := s.k8sclient.getClient(newCtx, q.OrgID)
		if !ok {
			return nil, nil
		}

		out, err := client.Get(newCtx, *q.UID, v1.GetOptions{})
		if err != nil {
			return nil, err
		}

		dashFolder, _ = internalfolders.UnstructuredToLegacyFolder(*out, q.SignedInUser.GetOrgID())
	case q.ID != nil:
		// not implemented
		return nil, folder.ErrBadRequest.Errorf("not implemented")
	case q.Title != nil:
		// not implemented
		return nil, folder.ErrBadRequest.Errorf("not implemented")
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

	dashFolder, err = s.setFullpath(ctx, dashFolder, q.SignedInUser)

	return dashFolder, err
}

func (s *Service) getChildrenFromApiServer(ctx context.Context, q *folder.GetChildrenQuery) ([]*folder.Folder, error) {
	if q.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	if s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) && q.UID == folder.SharedWithMeFolderUID {
		return s.GetSharedWithMe(ctx, q)
	}

	if q.UID == "" {
		return s.getRootFolders(ctx, q, true)
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

	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := s.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := s.k8sclient.getClient(newCtx, q.OrgID)
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
		f, _ := internalfolders.UnstructuredToLegacyFolder(item, q.SignedInUser.GetOrgID())
		if f == nil {
			return nil, fmt.Errorf("unable covert unstructured item to legacy folder")
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

func (s *Service) getParentsFromApiServer(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	if !s.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) || q.UID == accesscontrol.GeneralFolderUID {
		return nil, nil
	}
	if q.UID == folder.SharedWithMeFolderUID {
		return []*folder.Folder{&folder.SharedWithMeFolder}, nil
	}

	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := s.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := s.k8sclient.getClient(newCtx, q.OrgID)
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

		folder, _ := internalfolders.UnstructuredToLegacyFolder(*out, q.OrgID)
		if err != nil {
			return nil, err
		}

		parentUid = folder.ParentUID
		hits = append(hits, folder)
	}

	return util.Reverse(hits[1:]), nil
}

func (s *Service) CreateOnApiServer(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	newCtx, cancel, err := s.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := s.k8sclient.getClient(newCtx, cmd.OrgID)
	if !ok {
		return nil, nil
	}

	obj, err := internalfolders.LegacyCreateCommandToUnstructured(cmd)
	if err != nil {
		return nil, err
	}
	out, err := client.Create(newCtx, obj, v1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	folder, _ := internalfolders.UnstructuredToLegacyFolder(*out, cmd.SignedInUser.GetOrgID())
	if err != nil {
		return nil, err
	}

	return folder, err
}

func (s *Service) UpdateOnApiServer(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	newCtx, cancel, err := s.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := s.k8sclient.getClient(newCtx, cmd.OrgID)
	if !ok {
		return nil, nil
	}

	obj, err := client.Get(ctx, cmd.UID, v1.GetOptions{})
	if err != nil {
		return nil, err
	}

	updated, err := internalfolders.LegacyUpdateCommandToUnstructured(obj, cmd)
	if err != nil {
		return nil, err
	}

	out, err := client.Update(ctx, updated, v1.UpdateOptions{})
	if err != nil {
		return nil, err
	}

	folder, _ := internalfolders.UnstructuredToLegacyFolder(*out, cmd.SignedInUser.GetOrgID())
	if err != nil {
		return nil, err
	}

	return folder, err
}

func (s *Service) DeleteFromApiServer(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	newCtx, cancel, err := s.getK8sContext(ctx)
	if err != nil {
		return err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := s.k8sclient.getClient(newCtx, cmd.OrgID)
	if !ok {
		return nil
	}

	uid := cmd.UID
	err = client.Delete(newCtx, uid, v1.DeleteOptions{})
	if err != nil {
		return err
	}

	return nil
}

func (s *Service) MoveOnApiServer(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	// --
	newCtx, cancel, err := s.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := s.k8sclient.getClient(newCtx, cmd.OrgID)
	if !ok {
		return nil, nil
	}

	obj, err := client.Get(newCtx, cmd.UID, v1.GetOptions{})
	if err != nil {
		return nil, err
	}

	obj, err = internalfolders.LegacyMoveCommandToUnstructured(obj, *cmd)
	if err != nil {
		return nil, err
	}

	out, err := client.Update(newCtx, obj, v1.UpdateOptions{})
	if err != nil {
		return nil, err
	}

	folder, _ := internalfolders.UnstructuredToLegacyFolder(*out, cmd.SignedInUser.GetOrgID())
	if err != nil {
		return nil, err
	}

	return folder, err
}

func (s *Service) GetDescendantCountsFromApiServer(ctx context.Context, q *folder.GetDescendantCountsQuery) (folder.DescendantCounts, error) {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := s.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := s.k8sclient.getClient(newCtx, q.OrgID)
	if !ok {
		return nil, nil
	}

	uid := q.UID

	counts, err := client.Get(newCtx, *uid, v1.GetOptions{}, "counts")
	if err != nil {
		return nil, err
	}

	out, err := toFolderLegacyCounts(counts)
	if err != nil {
		return nil, err
	}

	return *out, nil
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

// -----------------------------------------------------------------------------------------
// Folder k8s functions
// -----------------------------------------------------------------------------------------

func (fk8s *foldk8sHandler) getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool) {
	cfg := &rest.Config{
		Host:    fk8s.cfg.AppURL,
		APIPath: "/apis",
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true, // Skip TLS verification
		},
		Username: fk8s.cfg.AdminUser,
		Password: fk8s.cfg.AdminPassword,
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

func (s *Service) getK8sContext(ctx context.Context) (context.Context, context.CancelFunc, error) {
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
