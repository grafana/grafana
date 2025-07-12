package folders

import (
	"context"
	"fmt"
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

	obj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	folderObj, ok := obj.(*folders.Folder)
	if !ok {
		return nil, fmt.Errorf("got something else than folders.Folder")
	}

	folderUID := folderObj.ObjectMeta.Name

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
		allMetadata := getFolderAccessControl(ctx, r.getter, user, folderObj)
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

func getFolderAccessControl(ctx context.Context, folderGetter rest.Getter, user identity.Requester, f *folders.Folder) map[string]accesscontrol.Metadata {
	parents := getFolderParents(ctx, folderGetter, f)
	folderIDs := map[string]bool{f.ObjectMeta.Name: true}

	for _, p := range parents.Items {
		folderIDs[p.Name] = true
	}
	return accesscontrol.GetResourcesMetadata(ctx, user.GetPermissions(), dashboards.ScopeFoldersPrefix, folderIDs)
}
