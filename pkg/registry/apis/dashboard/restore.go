package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
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

func (r *restoreREST) ConnectMethods() []string {
	return []string{"POST"}
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

type RestoreOptions struct {
	ResourceVersion int64 `json:"resourceVersion"`
}

func (r *restoreREST) Connect(ctx context.Context, uid string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
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
		body, err := io.ReadAll(req.Body)
		if err != nil {
			responder.Error(fmt.Errorf("unable to read request body: %s", err.Error()))
			return
		}
		reqBody := &RestoreOptions{}
		err = json.Unmarshal(body, &reqBody)
		if err != nil {
			responder.Error(fmt.Errorf("unable to unmarshal request body: %s", err.Error()))
			return
		}

		if reqBody.ResourceVersion == 0 {
			responder.Error(fmt.Errorf("resource version required"))
			return
		}

		rsp, err := r.unified.Restore(ctx, &resource.RestoreRequest{
			ResourceVersion: reqBody.ResourceVersion,
			Key:             key,
		})
		if err != nil {
			responder.Error(err)
			return
		} else if rsp == nil || (rsp.Error != nil && rsp.Error.Code == http.StatusNotFound) {
			responder.Error(storage.NewKeyNotFoundError(uid, reqBody.ResourceVersion))
			return
		} else if rsp.Error != nil {
			responder.Error(fmt.Errorf("could not re-create object: %s", rsp.Error.Message))
			return
		}

		obj := metav1.PartialObjectMetadata{
			ObjectMeta: metav1.ObjectMeta{
				Name:            key.Name,
				Namespace:       key.Namespace,
				ResourceVersion: strconv.FormatInt(rsp.ResourceVersion, 10),
			},
		}

		responder.Object(http.StatusOK, &obj)
	}), nil
}
