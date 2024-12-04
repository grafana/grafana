package file

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	file "github.com/grafana/grafana/pkg/apis/file/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type framesConnector struct {
	getter       rest.Getter
	blobStore    resource.BlobStoreClient
	largeObjects apistore.LargeObjectSupport
}

var _ = rest.Connecter(&framesConnector{})

func (r *framesConnector) New() runtime.Object {
	return &file.File{}
}

func (r *framesConnector) Destroy() {
}

func (r *framesConnector) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *framesConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *framesConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	obj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	t, ok := obj.(*file.File)
	if !ok {
		return nil, fmt.Errorf("expected dataset")
	}

	meta, err := utils.MetaAccessor(t)
	if err != nil {
		return nil, err
	}
	blobInfo := meta.GetBlob()
	if blobInfo != nil && r.largeObjects != nil {
		gr := r.largeObjects.GroupResource()
		err = r.largeObjects.Reconstruct(ctx, &resource.ResourceKey{
			Group:     gr.Group,
			Resource:  gr.Resource,
			Namespace: meta.GetNamespace(),
			Name:      meta.GetName(),
		}, r.blobStore, meta)
		if err != nil {
			return nil, err
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, t)
	}), nil
}
