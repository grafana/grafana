package folders

import (
	"context"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
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

	// Can view is managed by both the authorizer and the storage layer
	f, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	obj, err := utils.MetaAccessor(f)
	if err != nil {
		return nil, err
	}

	folder := obj.GetFolder()
	results, err := r.accessClient.BatchCheck(ctx, user, authlib.BatchCheckRequest{
		Namespace: ns.Value,
		Checks: []authlib.BatchCheckItem{{
			CorrelationID: "canAdmin",
			Verb:          utils.VerbSetPermissions,
			Group:         foldersV1.GROUP,
			Resource:      foldersV1.RESOURCE,
			Name:          name,
			Folder:        folder,
		}, {
			CorrelationID: "canDelete",
			Verb:          utils.VerbDelete,
			Group:         foldersV1.GROUP,
			Resource:      foldersV1.RESOURCE,
			Name:          name,
			Folder:        folder,
		}, {
			CorrelationID: "canEdit",
			Verb:          utils.VerbUpdate,
			Group:         foldersV1.GROUP,
			Resource:      foldersV1.RESOURCE,
			Name:          name,
			Folder:        folder,
		}, {
			CorrelationID: "canSave",
			Verb:          utils.VerbCreate, // new folder in the parent one
			Group:         foldersV1.GROUP,
			Resource:      foldersV1.RESOURCE,
			Name:          name,   // ?? seems weird, but removing it breaks a test
			Folder:        folder, // Create a new folder in the parent folder
		}},
	})
	if err != nil {
		return nil, err
	}

	check := func(key string) bool {
		v, ok := results.Results[key]
		if ok {
			return v.Allowed
		}
		return false
	}
	isAdmin := check("canAdmin")
	return &foldersV1.FolderAccessInfo{
		CanAdmin:  isAdmin,
		CanDelete: isAdmin || check("canDelete"),
		CanEdit:   isAdmin || check("canEdit"),
		CanSave:   isAdmin || check("canSave"),
	}, nil
}
