package folders

import (
	"context"
	"fmt"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

type subAccessREST struct {
	getter rest.Getter
	authz  authz.AccessClient
}

var _ = rest.Connecter(&subAccessREST{})
var _ = rest.StorageMetadata(&subAccessREST{})

func (r *subAccessREST) New() runtime.Object {
	return &v0alpha1.FolderAccessInfo{}
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
	return &v0alpha1.FolderAccessInfo{}
}

func (r *subAccessREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subAccessREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	// need to get the object to get the folder
	obj, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}

	folder, ok := obj.(*v0alpha1.Folder)
	if !ok {
		return nil, fmt.Errorf("expected a folder object")
	}

	m, err := utils.MetaAccessor(folder)
	if err != nil {
		return nil, err
	}

	// Check for the request claims
	user, ok := claims.From(ctx)
	if !ok {
		return nil, errNoUser
	}

	// TODO! this client should have a better bulk request mode
	// For now, we make a request for each legacy flavor we need in the UI
	req := authz.CheckRequest{
		Group:     v0alpha1.GROUP,
		Resource:  v0alpha1.RESOURCE,
		Namespace: folder.Namespace,
		Name:      folder.Name,
		Folder:    m.GetFolder(), // the parent folder
	}

	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		access := &v0alpha1.FolderAccessInfo{}

		// EDIT
		req.Verb = utils.VerbUpdate
		rsp, err := r.authz.Check(ctx, user, req)
		if err != nil {
			responder.Error(err)
			return
		}
		access.CanEdit = rsp.Allowed

		// SAVE
		req.Verb = utils.VerbCreate
		rsp, err = r.authz.Check(ctx, user, req)
		if err != nil {
			responder.Error(err)
			return
		}
		access.CanSave = rsp.Allowed

		// ADMIN
		req.Verb = utils.VerbSetPermissions
		rsp, err = r.authz.Check(ctx, user, req)
		if err != nil {
			responder.Error(err)
			return
		}
		access.CanAdmin = rsp.Allowed

		// DELETE
		req.Verb = utils.VerbDelete
		rsp, err = r.authz.Check(ctx, user, req)
		if err != nil {
			responder.Error(err)
			return
		}
		access.CanDelete = rsp.Allowed

		// write the response
		responder.Object(http.StatusOK, access)
	}), nil
}
