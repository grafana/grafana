package dashboard

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// LatestConnector will return the latest version of the resource - even if it is deleted
type LatestConnector interface {
	rest.Storage
	rest.Connecter
	rest.StorageMetadata
}

func NewLatestConnector(unified resource.ResourceClient, gr schema.GroupResource, opts generic.RESTOptions, scheme *runtime.Scheme) LatestConnector {
	return &latestREST{
		unified: unified,
		gr:      gr,
		opts:    opts,
		scheme:  scheme,
	}
}

type latestREST struct {
	unified resource.ResourceClient
	gr      schema.GroupResource
	opts    generic.RESTOptions
	scheme  *runtime.Scheme
}

func (l *latestREST) New() runtime.Object {
	return &metav1.PartialObjectMetadataList{}
}

func (l *latestREST) Destroy() {
}

func (l *latestREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (l *latestREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (l *latestREST) ProducesObject(verb string) interface{} {
	return &metav1.PartialObjectMetadataList{}
}

func (l *latestREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (l *latestREST) Connect(ctx context.Context, uid string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	key := &resource.ResourceKey{
		Namespace: info.Value,
		Group:     l.gr.Group,
		Resource:  l.gr.Resource,
		Name:      uid,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		rsp, err := l.unified.Read(ctx, &resource.ReadRequest{
			Key:             key,
			ResourceVersion: 0, // 0 will return the latest version that was not a delete event
			IncludeDeleted:  true,
		})
		if err != nil {
			responder.Error(err)
			return
		} else if rsp == nil || (rsp.Error != nil && rsp.Error.Code == http.StatusNotFound) {
			responder.Error(storage.NewKeyNotFoundError(uid, 0))
			return
		} else if rsp.Error != nil {
			responder.Error(fmt.Errorf("could not retrieve object: %s", rsp.Error.Message))
			return
		}

		uncastObj, err := runtime.Decode(unstructured.UnstructuredJSONScheme, rsp.Value)
		if err != nil {
			responder.Error(fmt.Errorf("could not convert object: %s", err.Error()))
			return
		}

		finalObj := uncastObj.(*unstructured.Unstructured)
		finalObj.SetResourceVersion(strconv.FormatInt(rsp.ResourceVersion, 10))

		responder.Object(http.StatusOK, finalObj)
	}), nil
}
