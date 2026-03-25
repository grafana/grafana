package v1beta1

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// getConnectionClient returns a K8sResourceClient configured for v1beta1 Connections
func getConnectionClient(helper *apis.K8sTestHelper) *apis.K8sResourceClient {
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR: schema.GroupVersionResource{
			Group:    "provisioning.grafana.app",
			Version:  "v1beta1",
			Resource: "connections",
		},
	})
}

// getRepositoryClient returns a K8sResourceClient configured for v1beta1 Repositories
func getRepositoryClient(helper *apis.K8sTestHelper) *apis.K8sResourceClient {
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR: schema.GroupVersionResource{
			Group:    "provisioning.grafana.app",
			Version:  "v1beta1",
			Resource: "repositories",
		},
	})
}

// toUnstructured converts a Connection to an unstructured object
func toUnstructured(obj *provisioning.Connection) (*unstructured.Unstructured, error) {
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return nil, err
	}
	return &unstructured.Unstructured{Object: unstructuredObj}, nil
}

// fromUnstructuredToConnection converts an unstructured object to a Connection
func fromUnstructuredToConnection(obj *unstructured.Unstructured) (*provisioning.Connection, error) {
	conn := &provisioning.Connection{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, conn)
	return conn, err
}

// toUnstructuredRepository converts a Repository to an unstructured object
func toUnstructuredRepository(obj *provisioning.Repository) (*unstructured.Unstructured, error) {
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return nil, err
	}
	return &unstructured.Unstructured{Object: unstructuredObj}, nil
}

// fromUnstructuredToRepository converts an unstructured object to a Repository
func fromUnstructuredToRepository(obj *unstructured.Unstructured) (*provisioning.Repository, error) {
	repo := &provisioning.Repository{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, repo)
	return repo, err
}
