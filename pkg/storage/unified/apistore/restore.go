package apistore

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type RestoreConnector interface {
	rest.Storage
	rest.Connecter
	rest.StorageMetadata
}

func NewRestoreConnector(unified resource.ResourceClient, gr schema.GroupResource, opts generic.RESTOptions) RestoreConnector {
	return &restoreREST{
		unified: unified,
		gr:      gr,
		opts:    opts,
	}
}

type restoreREST struct {
	unified resource.ResourceClient
	gr      schema.GroupResource
	opts    generic.RESTOptions
}

func (r *restoreREST) New() runtime.Object {
	return &metav1.PartialObjectMetadataList{}
}

func (r *restoreREST) Destroy() {
}

// TODO: change to POST
func (r *restoreREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *restoreREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *restoreREST) ProducesObject(verb string) interface{} {
	return &metav1.PartialObjectMetadataList{}
}

func (r *restoreREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *restoreREST) Connect(ctx context.Context, uid string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	key := &resource.ResourceKey{
		Namespace: info.Value,
		Group:     r.gr.Group,
		Resource:  r.gr.Resource,
		Name:      uid,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		query := req.URL.Query()
		res := query.Get("resourceVersion")
		rv, err := strconv.ParseInt(res, 10, 64)
		if err != nil || rv == 0 {
			responder.Error(fmt.Errorf("invalid resourceVersion: %s", res))
			return
		}

		rsp, err := r.unified.Read(ctx, &resource.ReadRequest{
			Key:             key,
			ResourceVersion: int64(rv),
			IncludeDeleted:  true,
		})
		if err != nil || rsp == nil || rsp.Error != nil {
			responder.Error(fmt.Errorf("could not find old resource: %s", res))
			return
		}

		finalRsp, err := r.unified.Create(ctx, &resource.CreateRequest{
			Value: rsp.Value,
			Key:   key,
		})
		if err != nil || finalRsp == nil || finalRsp.Error != nil {
			responder.Error(fmt.Errorf("could not re-create resource: %s", res))
			return
		}

		obj := metav1.PartialObjectMetadata{
			ObjectMeta: metav1.ObjectMeta{
				Name:            key.Name,
				Namespace:       key.Namespace,
				ResourceVersion: strconv.FormatInt(finalRsp.ResourceVersion, 10),
			},
		}

		responder.Object(http.StatusOK, &obj)
	}), nil
}
