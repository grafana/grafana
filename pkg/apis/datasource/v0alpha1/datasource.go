package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSource struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`

	// DataSource configuration -- these properties are all visible
	// to anyone able to query the data source from their browser
	Spec UnstructuredSpec `json:"spec"`

	// Secure values allows setting values that are never shown to users
	// The returned properties are only the names of the configured values
	Secure common.InlineSecureValues `json:"secure,omitzero,omitempty"`
}

func (DataSource) OpenAPIModelName() string {
	return OpenAPIPrefix + "DataSource"
}

func (ds DataSource) ToUnstructured() (*unstructured.Unstructured, error) {
	metadata, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&ds.ObjectMeta)
	if err != nil {
		return nil, err
	}
	obj := &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": metadata,
			"spec":     ds.Spec.Object,
		},
	}
	if len(ds.Secure) > 0 {
		secure := map[string]any{}
		for k, v := range ds.Secure {
			sv := map[string]any{}
			if !v.Create.IsZero() {
				sv["create"] = string(v.Create)
			}
			if v.Name != "" {
				sv["name"] = v.Name
			}
			if v.Remove {
				sv["remove"] = true
			}
			secure[k] = sv
		}
		obj.Object["secure"] = secure
	}
	if ds.APIVersion != "" {
		obj.SetAPIVersion(ds.APIVersion)
	}
	if ds.Kind != "" {
		obj.SetKind(ds.Kind)
	}
	return obj, nil
}

func FromUnstructured(obj *unstructured.Unstructured) (*DataSource, error) {
	ds := &DataSource{
		TypeMeta: metav1.TypeMeta{
			APIVersion: obj.GetAPIVersion(),
			Kind:       obj.GetKind(),
		},
		Spec: UnstructuredSpec{},
	}
	metadata, _, err := unstructured.NestedMap(obj.Object, "metadata")
	if err != nil {
		return nil, err
	}

	if err = runtime.DefaultUnstructuredConverter.FromUnstructured(metadata, &ds.ObjectMeta); err != nil {
		return nil, fmt.Errorf("failed to convert unstructured to ObjectMeta: %w", err)
	}
	ds.Spec.Object, _, err = unstructured.NestedMap(obj.Object, "spec")
	if err != nil {
		return nil, fmt.Errorf("failed to read spec from unstructured object")
	}

	// Read secure values
	_, ok := obj.Object["secure"]
	if ok {
		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return nil, err
		}
		sv, err := meta.GetSecureValues()
		if err != nil {
			return nil, err
		}
		ds.Secure = sv
	}
	return ds, nil
}

// DsAccess represents how the datasource connects to the remote service
// +k8s:openapi-gen=true
// +enum
type DsAccess string

const (
	// The frontend can connect directly to the remote URL
	// This method is discouraged
	DsAccessDirect DsAccess = "direct"

	// Connect to the remote datasource through the grafana backend
	DsAccessProxy DsAccess = "proxy"
)

func (dsa DsAccess) String() string {
	return string(dsa)
}

// +k8s:openapi-gen=true
type GenericDataSourceSpec struct {
	// The display name (previously saved as the "name" property)
	Title string `json:"title"`

	Access   DsAccess `json:"access,omitempty"`
	ReadOnly bool     `json:"readOnly,omitempty"`
	Ordinal  int64    `json:"ordinal,omitempty,omitzero"`

	// Deprecated: use ordinal=1
	IsDefault bool `json:"isDefault,omitempty"`

	// Server URL
	URL string `json:"url,omitempty"`

	User            string `json:"user,omitempty"`
	Database        string `json:"database,omitempty"`
	BasicAuth       bool   `json:"basicAuth,omitempty"`
	BasicAuthUser   string `json:"basicAuthUser,omitempty"`
	WithCredentials bool   `json:"withCredentials,omitempty"`

	// Generic unstructured configuration settings
	JsonData common.Unstructured `json:"jsonData,omitzero"`
}

func (GenericDataSourceSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "GenericDataSourceSpec"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`

	Items []DataSource `json:"items"`
}

func (DataSourceList) OpenAPIModelName() string {
	return OpenAPIPrefix + "DataSourceList"
}
