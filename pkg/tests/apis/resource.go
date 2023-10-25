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

type ResourceResponse struct {
	Response *http.Response
	Resource *AnyResource
	Status   *metav1.Status
}

func (c K8sTestContext) PostResource(user User, resource string, payload AnyResource) ResourceResponse {
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

	return c.processResourceResponse(c.Post(PostParams{
		path: path,
		user: user,
		body: string(body),
	}))
}

func (c K8sTestContext) PutResource(user User, resource string, payload AnyResource) ResourceResponse {
	c.t.Helper()

	path := fmt.Sprintf("/apis/%s/namespaces/%s/%s/%s",
		payload.APIVersion, payload.Namespace, resource, payload.Name)

	body, err := json.Marshal(payload)
	require.NoError(c.t, err)

	return c.processResourceResponse(c.Put(PostParams{
		path: path,
		user: user,
		body: string(body),
	}))
}

func (c K8sTestContext) processResourceResponse(response *http.Response) ResourceResponse {
	c.t.Helper()

	out := ResourceResponse{Response: response}
	defer response.Body.Close()
	raw, err := io.ReadAll(response.Body)
	require.NoError(c.t, err)

	if json.Valid(raw) {
		out.Resource = &AnyResource{}
		err = json.Unmarshal(raw, out.Resource)
		require.NoError(c.t, err)

		// It may be a response status
		if out.Resource.Kind == "Status" {
			out.Resource = nil
			out.Status = &metav1.Status{}
			err = json.Unmarshal(raw, out.Status)
			require.NoError(c.t, err)
		}
	}
	return out
}

// Read local JSON or YAML file into a resource
func (c K8sTestContext) LoadAnyResource(fpath string) AnyResource {
	c.t.Helper()

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

func (c K8sTestContext) List(user User, gvr schema.GroupVersionResource, namespace string) (*http.Response, *AnyResourceList, *metav1.Status) {
	c.t.Helper()

	resp := c.Get(GetParams{
		url: fmt.Sprintf("/apis/%s/%s/namespaces/%s/%s",
			gvr.Group, gvr.Version, namespace, gvr.Resource),
		user: user,
	})
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	require.NoError(c.t, err)

	var status *metav1.Status
	list := &AnyResourceList{}
	if json.Valid(raw) {
		err = json.Unmarshal(raw, list)
	} else {
		err = yaml.Unmarshal(raw, list)
	}
	require.NoError(c.t, err)

	// It may be a response status
	if list.Kind == "Status" {
		list = nil
		status = &metav1.Status{}
		if json.Valid(raw) {
			err = json.Unmarshal(raw, status)
		} else {
			err = yaml.Unmarshal(raw, status)
		}
		require.NoError(c.t, err)
	}
	return resp, list, status
}
