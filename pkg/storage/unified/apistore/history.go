package apistore

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type HistoryConnector interface {
	rest.Storage
	rest.Connecter
	rest.StorageMetadata
}

func NewHistoryConnector(index resource.ResourceIndexServer, gr schema.GroupResource) HistoryConnector {
	return &historyREST{
		index: index,
		gr:    gr,
	}
}

type historyREST struct {
	index resource.ResourceIndexServer // should be a client!
	gr    schema.GroupResource
}

func (r *historyREST) New() runtime.Object {
	return &metav1.PartialObjectMetadataList{}
}

func (r *historyREST) Destroy() {
}

func (r *historyREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *historyREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *historyREST) ProducesObject(verb string) interface{} {
	return &metav1.PartialObjectMetadataList{}
}

func (r *historyREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *historyREST) Connect(ctx context.Context, uid string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
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
		query := req.URL.Query()
		rsp, err := r.index.History(ctx, &resource.HistoryRequest{
			NextPageToken: query.Get("token"),
			Limit:         100, // TODO, from query
			Key:           key,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		list := &metav1.PartialObjectMetadataList{
			ListMeta: metav1.ListMeta{
				Continue: rsp.NextPageToken,
			},
		}
		if rsp.ResourceVersion > 0 {
			list.ResourceVersion = strconv.FormatInt(rsp.ResourceVersion, 10)
		}
		for _, v := range rsp.Items {
			partial := metav1.PartialObjectMetadata{}
			err = json.Unmarshal(v.PartialObjectMeta, &partial)
			if err != nil {
				responder.Error(err)
				return
			}
			list.Items = append(list.Items, partial)
		}
		responder.Object(http.StatusOK, list)
	}), nil
}
