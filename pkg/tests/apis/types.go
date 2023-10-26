package apis

import (
	"encoding/json"
	"os"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

// Read local JSON or YAML file into a resource
func (c *K8sTestHelper) LoadAnyResource(fpath string) AnyResource {
	c.t.Helper()

	//nolint:gosec
	raw, err := os.ReadFile(fpath)
	require.NoError(c.t, err)
	require.NotEmpty(c.t, raw)

	res := &AnyResource{}
	if json.Valid(raw) {
		err = json.Unmarshal(raw, res)
	} else {
		err = yaml.Unmarshal(raw, res)
	}
	require.NoError(c.t, err)
	return *res
}
