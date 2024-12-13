package folders

import (
	"context"
	"fmt"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

type subParentsREST struct {
	getter rest.Getter
}

var _ = rest.Connecter(&subParentsREST{})
var _ = rest.StorageMetadata(&subParentsREST{})

func (r *subParentsREST) New() runtime.Object {
	return &v0alpha1.FolderInfoList{}
}

func (r *subParentsREST) Destroy() {
}

func (r *subParentsREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subParentsREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subParentsREST) ProducesObject(verb string) interface{} {
	return &v0alpha1.FolderInfoList{}
}

func (r *subParentsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subParentsREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("expecting namespace")
	}

	// the current folder
	obj, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	folder, ok := obj.(*v0alpha1.Folder)
	if !ok {
		return nil, fmt.Errorf("expecting folder, found: %T", folder)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		info := &v0alpha1.FolderInfoList{
			Items: []v0alpha1.FolderInfo{},
		}

		// Walk up the tree
		for folder != nil {
			parent := ""
			meta, _ := utils.MetaAccessor(folder)
			folder = nil
			if meta != nil {
				parent = meta.GetFolder()
			}
			info.Items = append(info.Items, v0alpha1.FolderInfo{
				Name:        folder.Name,
				Title:       folder.Spec.Title,
				Description: folder.Spec.Description,
				Parent:      parent,
			})
			folder = nil
			if parent != "" {
				obj, err = r.getter.Get(ctx, parent, &v1.GetOptions{})
				if err != nil {

				}
				folder, ok := obj.(*v0alpha1.Folder)
				if !ok {
					return nil, fmt.Errorf("expecting folder, found: %T", folder)
				}
			}
		}

		parents, err := r.service.GetParents(ctx, folder.GetParentsQuery{
			UID:   name,
			OrgID: ns.OrgID,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		for _, parent := range parents {
			info.Items = append(info.Items, v0alpha1.FolderInfo{
				UID:    parent.UID,
				Title:  parent.Title,
				Parent: parent.ParentUID,
			})
		}
		responder.Object(http.StatusOK, info)
	}), nil
}
