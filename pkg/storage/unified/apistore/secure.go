package apistore

import (
	"context"
	"encoding/json"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type SecureConnector interface {
	rest.Storage
	rest.Connecter
	rest.StorageMetadata
}

func NewSecureConnector(client resource.ResourceStoreClient, info utils.ResourceInfo) SecureConnector {
	return &secureREST{client, info}
}

type secureREST struct {
	client resource.ResourceStoreClient
	info   utils.ResourceInfo
}

func (r *secureREST) New() runtime.Object {
	return r.info.NewFunc()
}

func (r *secureREST) Destroy() {
}

func (r *secureREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *secureREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *secureREST) ProducesObject(verb string) interface{} {
	return r.info.NewFunc()
}

func (r *secureREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *secureREST) Connect(ctx context.Context, uid string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := namespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	gr := r.info.GroupResource()
	key := &resource.ResourceKey{
		Namespace: info.Value,
		Group:     gr.Group,
		Resource:  gr.Resource,
		Name:      uid,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		rsp, err := r.client.Read(ctx, &resource.ReadRequest{
			Key:                 key,
			DecryptSecureValues: true,
		})
		if err != nil {
			responder.Error(err)
			return
		}
		if rsp.Error != nil {
			responder.Error(resource.GetError(rsp.Error))
			return
		}

		obj := r.info.NewFunc()
		err = json.Unmarshal(rsp.Value, obj) // or codec?
		if err != nil {
			responder.Error(err)
			return
		}

		// Update the secure values with the decrypted parts
		if len(rsp.SecureValues) > 0 {
			m, err := utils.MetaAccessor(obj)
			if err != nil {
				responder.Error(err)
				return
			}
			for k, v := range rsp.SecureValues {
				err = m.SetSecureValue(k, v0alpha1.SecureValue{
					GUID:  v.Guid,
					Value: v.Value,
					Ref:   v.Refid,
				})
				if err != nil {
					responder.Error(err)
					return
				}
			}
		}
		responder.Object(http.StatusOK, obj)
	}), nil
}
