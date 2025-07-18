package folders

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/services/folder"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

type subAccessREST struct {
	getter rest.Getter
	ac     accesscontrol.AccessControl
}

var _ = rest.Connecter(&subAccessREST{})
var _ = rest.StorageMetadata(&subAccessREST{})

func (r *subAccessREST) New() runtime.Object {
	return &folders.FolderAccessInfo{}
}

func (r *subAccessREST) Destroy() {
}

func (r *subAccessREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subAccessREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subAccessREST) ProducesObject(verb string) interface{} {
	return &folders.FolderAccessInfo{}
}

func (r *subAccessREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subAccessREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	folderUID := name

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		access := &folders.FolderAccessInfo{}
		canEditEvaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID))
		access.CanEdit, _ = r.ac.Evaluate(ctx, user, canEditEvaluator)
		access.CanSave = access.CanEdit
		canAdminEvaluator := accesscontrol.EvalAll(
			accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)),
			accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)),
		)
		access.CanAdmin, _ = r.ac.Evaluate(ctx, user, canAdminEvaluator)
		canDeleteEvaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID))
		access.CanDelete, _ = r.ac.Evaluate(ctx, user, canDeleteEvaluator)

		// Cargo culted from pkg/api/folder.go#getFolderACMetadata
		allMetadata, err := getFolderAccessControl(ctx, r.getter, user, name)
		if err != nil {
			responder.Error(err)
			return
		}
		metadata := map[string]bool{}
		// Flatten metadata - if any parent has a permission, the child folder inherits it
		for _, md := range allMetadata {
			for action := range md {
				metadata[action] = true
			}
		}

		access.AccessControl = metadata
		responder.Object(http.StatusOK, access)
	}), nil
}

func getFolderAccessControl(ctx context.Context, folderGetter rest.Getter, user identity.Requester, name string) (map[string]accesscontrol.Metadata, error) {
	folderIDs := map[string]bool{name: true}

	if name != folder.GeneralFolderUID && name != folder.SharedWithMeFolderUID {
		obj, err := folderGetter.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		folderObj, ok := obj.(*folders.Folder)
		if !ok {
			return nil, fmt.Errorf("expecting folder, found: %T", folderObj)
		}
		parents := getFolderParents(ctx, folderGetter, folderObj)
		for _, p := range parents.Items {
			folderIDs[p.Name] = true
		}
	}

	return accesscontrol.GetResourcesMetadata(ctx, user.GetPermissions(), dashboards.ScopeFoldersPrefix, folderIDs), nil
}
