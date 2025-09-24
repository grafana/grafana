package folders

import (
	"context"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

type subAccessREST struct {
	getter       rest.Getter
	accessClient authlib.AccessClient
}

var _ = rest.Connecter(&subAccessREST{})
var _ = rest.StorageMetadata(&subAccessREST{})

func (r *subAccessREST) New() runtime.Object {
	return &foldersV1.FolderAccessInfo{}
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
	return &foldersV1.FolderAccessInfo{}
}

func (r *subAccessREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subAccessREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		access, err := r.getAccessInfo(ctx, name)
		if err != nil {
			responder.Error(err)
		} else {
			responder.Object(200, access)
		}
	}), nil
}

func (r *subAccessREST) getAccessInfo(ctx context.Context, name string) (*foldersV1.FolderAccessInfo, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	// Can view is managed here (and in the Authorizer)
	f, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	obj, err := utils.MetaAccessor(f)
	if err != nil {
		return nil, err
	}
	var tmp authlib.CheckResponse
	check := func(verb string) bool {
		if err != nil {
			return false
		}
		tmp, err = r.accessClient.Check(ctx, user, authlib.CheckRequest{
			Verb:      verb,
			Group:     foldersV1.GROUP,
			Resource:  foldersV1.RESOURCE,
			Namespace: ns.Value,
			Name:      name,
			Folder:    obj.GetFolder(),
		})
		return tmp.Allowed
	}

	rsp := &foldersV1.FolderAccessInfo{}
	rsp.CanAdmin = check(utils.VerbSetPermissions)
	if err != nil {
		return nil, err
	}
	rsp.CanDelete = rsp.CanAdmin || check(utils.VerbDelete)
	if err != nil {
		return nil, err
	}
	rsp.CanEdit = rsp.CanAdmin || check(utils.VerbUpdate)
	if err != nil {
		return nil, err
	}
	rsp.CanSave = rsp.CanAdmin || check(utils.VerbCreate) // or the same as update?
	if err != nil {
		return nil, err
	}
	return rsp, nil
}
