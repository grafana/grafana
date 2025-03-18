package folders

import (
	"context"
	"fmt"
	"net/http"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

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
	obj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	folder, ok := obj.(*v0alpha1.Folder)
	if !ok {
		return nil, fmt.Errorf("expecting folder, found: %T", folder)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		info := r.parents(ctx, folder)
		// Start from the root
		slices.Reverse(info.Items)
		responder.Object(http.StatusOK, info)
	}), nil
}

func (r *subParentsREST) parents(ctx context.Context, folder *v0alpha1.Folder) *v0alpha1.FolderInfoList {
	info := &v0alpha1.FolderInfoList{
		Items: []v0alpha1.FolderInfo{},
	}
	for folder != nil {
		parent := getParent(folder)
		info.Items = append(info.Items, v0alpha1.FolderInfo{
			Name:        folder.Name,
			Title:       folder.Spec.Title,
			Description: folder.Spec.Description,
			Parent:      parent,
		})
		if parent == "" {
			break
		}

		obj, err := r.getter.Get(ctx, parent, &metav1.GetOptions{})
		if err != nil {
			info.Items = append(info.Items, v0alpha1.FolderInfo{
				Name:        parent,
				Detached:    true,
				Description: err.Error(),
			})
			break
		}

		parentFolder, ok := obj.(*v0alpha1.Folder)
		if !ok {
			info.Items = append(info.Items, v0alpha1.FolderInfo{
				Name:        parent,
				Detached:    true,
				Description: fmt.Sprintf("expected folder, found: %T", obj),
			})
			break
		}
		folder = parentFolder
	}
	return info
}
