package client

// import (
// 	"context"
// 	"encoding/json"

// 	"github.com/grafana/grafana/pkg/services/apiserver"
// 	"github.com/grafana/grafana/pkg/services/apiserver/client"
// 	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
// 	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
// 	"k8s.io/apimachinery/pkg/runtime/schema"
// 	"k8s.io/client-go/kubernetes"
// )

// // K8sClientFactory creates a K8sClient for the given group
// type K8sClientFactory func(ctx context.Context, group string, version string) client.K8sHandler

// type K8sHandler struct {
// 	client.K8sHandler
// 	restConfigProvider apiserver.RestConfigProvider
// 	gvr                schema.GroupVersionResource
// }

// type K8sClient struct {
// 	client.K8sHandler
// 	newClientFunc K8sClientFactory
// }

// func ProvideK8sClient(
// 	restConfigProvider apiserver.RestConfigProvider,
// ) K8sHandler {
// 	return NewK8sClient(restConfigProvider)
// }

// func NewK8sClient(restConfigProvider apiserver.RestConfigProvider) *K8sClient {
// 	newClientFunc := newK8sClientFactory(restConfigProvider)
// 	return &K8sClient{
// 		K8sHandler: newClientFunc(context.Background(),),
// 	}
// }

// func (c K8sHandler) Get(ctx context.Context, name string, orgID int64, options v1.GetOptions, subresource ...string) (*unstructured.Unstructured, error) {
// 	cfg, err := c.restConfigProvider.GetRestConfig(ctx)
// 	if err != nil {
// 		return nil, err
// 	}
// 	client, err := kubernetes.NewForConfig(cfg)
// 	if err != nil {
// 		return nil, err
// 	}

// 	result := client.RESTClient().Get().
// 		Prefix("apis", c.gvr.Group, c.gvr.Version).
// 		Namespace(string(orgID)).
// 		Resource(c.gvr.Resource).
// 		Name(name).
// 		Do(ctx)

// 	if err = result.Error(); err != nil {
// 		return nil, err
// 	}

// 	body, err := result.Raw()
// 	if err != nil {
// 		return nil, err
// 	}

// 	value := &unstructured.Unstructured{}
// 	if err = json.Unmarshal(body, value); err != nil {
// 		return nil, err
// 	}

// 	return value, nil
// }

// func newK8sClientFactory(restConfigProvider apiserver.RestConfigProvider) K8sClientFactory {
// 	return func(ctx context.Context, group string, version string) client.K8sHandler {
// 		gvr := schema.GroupVersionResource{
// 			Group:    group,
// 			Version:  version,
// 			Resource: "datasources",
// 		}

// 		return K8sHandler{
// 			restConfigProvider: restConfigProvider,
// 			gvr:                gvr,
// 		}

// 	}
// }
