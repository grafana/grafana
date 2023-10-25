package apis

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"
)

type AnyResource struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Generic object
	Spec map[string]any `json:"spec,omitempty"`
}

type AnyResourceList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []map[string]any `json:"items,omitempty"`
}

type K8sResponse[T any] struct {
	Response *http.Response
	Body     []byte
	Result   *T
	Status   *metav1.Status
}

type AnyResourceResponse = K8sResponse[AnyResource]
type AnyResourceListResponse = K8sResponse[AnyResourceList]

func newK8sResponse[T any](rsp *http.Response, result *T) K8sResponse[T] {
	r := K8sResponse[T]{
		Response: rsp,
		Result:   result,
	}
	defer func() {
		_ = rsp.Body.Close() // ignore any close errors
	}()
	r.Body, _ = io.ReadAll(rsp.Body)
	if json.Valid(r.Body) {
		_ = json.Unmarshal(r.Body, r.Result)

		s := &metav1.Status{}
		err := json.Unmarshal(r.Body, s)
		if err == nil && s.Kind == "Status" { // Usually an error!
			r.Status = s
			r.Result = nil
		}
	} else {
		_ = yaml.Unmarshal(r.Body, r.Result)
	}
	return r
}

func (c K8sTestContext) PostResource(user User, resource string, payload AnyResource) AnyResourceResponse {
	c.t.Helper()

	namespace := payload.Namespace
	if namespace == "" {
		namespace = "default"
		if user.User.OrgID > 1 {
			namespace = fmt.Sprintf("org-%d", user.User.OrgID)
		}
	}

	path := fmt.Sprintf("/apis/%s/namespaces/%s/%s",
		payload.APIVersion, namespace, resource)
	if payload.Name != "" {
		path = fmt.Sprintf("%s/%s", path, payload.Name)
	}

	body, err := json.Marshal(payload)
	require.NoError(c.t, err)

	return newK8sResponse(c.Post(PostParams{
		path: path,
		user: user,
		body: string(body),
	}), &AnyResource{})
}

func (c K8sTestContext) PutResource(user User, resource string, payload AnyResource) AnyResourceResponse {
	c.t.Helper()

	path := fmt.Sprintf("/apis/%s/namespaces/%s/%s/%s",
		payload.APIVersion, payload.Namespace, resource, payload.Name)

	body, err := json.Marshal(payload)
	require.NoError(c.t, err)

	return newK8sResponse(c.Put(PostParams{
		path: path,
		user: user,
		body: string(body),
	}), &AnyResource{})
}

// Read local JSON or YAML file into a resource
func (c K8sTestContext) LoadAnyResource(fpath string) AnyResource {
	c.t.Helper()

	//nolint:gosec
	raw, err := os.ReadFile(fpath)
	require.NoError(c.t, err)
	return c.readAnyResource(raw)
}

func (c K8sTestContext) readAnyResource(raw []byte) AnyResource {
	c.t.Helper()
	require.NotEmpty(c.t, raw)

	var err error
	res := &AnyResource{}
	if json.Valid(raw) {
		err = json.Unmarshal(raw, res)
	} else {
		err = yaml.Unmarshal(raw, res)
	}
	require.NoError(c.t, err)
	return *res
}

func (c K8sTestContext) List(user User, gvr schema.GroupVersionResource, namespace string) AnyResourceListResponse {
	c.t.Helper()

	return newK8sResponse(c.Get(GetParams{
		url: fmt.Sprintf("/apis/%s/%s/namespaces/%s/%s",
			gvr.Group, gvr.Version, namespace, gvr.Resource),
		user: user,
	}), &AnyResourceList{})
}
