package v0alpha1

import (
	"encoding/json"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// UnstructuredSpec allows any property to be saved into the spec
// Validation will happen from the dynamically loaded schemas for each datasource
// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type UnstructuredSpec common.Unstructured

func (u *UnstructuredSpec) GetString(key string) string {
	if u.Object == nil {
		return ""
	}
	v := u.Object[key]
	str, _ := v.(string)
	return str
}

func (u *UnstructuredSpec) Set(key string, val any) *UnstructuredSpec {
	if u.Object == nil {
		u.Object = make(map[string]any)
	}
	if val == nil || val == "" || val == false {
		delete(u.Object, key)
	} else {
		u.Object[key] = val
	}
	return u
}

func (u *UnstructuredSpec) Title() string {
	return u.GetString("title")
}

func (u *UnstructuredSpec) SetTitle(v string) *UnstructuredSpec {
	return u.Set("title", v)
}

func (u *UnstructuredSpec) URL() string {
	return u.GetString("url")
}

func (u *UnstructuredSpec) SetURL(v string) *UnstructuredSpec {
	return u.Set("url", v)
}

func (u *UnstructuredSpec) Database() string {
	return u.GetString("database")
}

func (u *UnstructuredSpec) SetDatabase(v string) *UnstructuredSpec {
	return u.Set("database", v)
}

func (u *UnstructuredSpec) Access() DsAccess {
	return DsAccess(u.GetString("access"))
}

func (u *UnstructuredSpec) SetAccess(v string) *UnstructuredSpec {
	return u.Set("access", v)
}

func (u *UnstructuredSpec) User() string {
	return u.GetString("user")
}

func (u *UnstructuredSpec) SetUser(v string) *UnstructuredSpec {
	return u.Set("user", v)
}

func (u *UnstructuredSpec) BasicAuth() bool {
	v, _, _ := unstructured.NestedBool(u.Object, "basicAuth")
	return v
}

func (u *UnstructuredSpec) SetBasicAuth(v bool) *UnstructuredSpec {
	return u.Set("basicAuth", v)
}

func (u *UnstructuredSpec) BasicAuthUser() string {
	return u.GetString("basicAuthUser")
}

func (u *UnstructuredSpec) SetBasicAuthUser(v string) *UnstructuredSpec {
	return u.Set("basicAuthUser", v)
}

func (u *UnstructuredSpec) WithCredentials() bool {
	v, _, _ := unstructured.NestedBool(u.Object, "withCredentials")
	return v
}

func (u *UnstructuredSpec) SetWithCredentials(v bool) *UnstructuredSpec {
	return u.Set("withCredentials", v)
}

func (u *UnstructuredSpec) IsDefault() bool {
	v, _, _ := unstructured.NestedBool(u.Object, "isDefault")
	return v
}

func (u *UnstructuredSpec) SetIsDefault(v bool) *UnstructuredSpec {
	return u.Set("isDefault", v)
}

func (u *UnstructuredSpec) ReadOnly() bool {
	v, _, _ := unstructured.NestedBool(u.Object, "readOnly")
	return v
}

func (u *UnstructuredSpec) SetReadOnly(v bool) *UnstructuredSpec {
	return u.Set("readOnly", v)
}

func (u *UnstructuredSpec) JSONData() any {
	return u.Object["jsonData"]
}

func (u *UnstructuredSpec) SetJSONData(v any) *UnstructuredSpec {
	return u.Set("jsonData", v)
}

// The OpenAPI spec uses the generated values from GenericDataSourceSpec, except that it:
// 1. Allows additional properties at the root
// 2. The jsonData field *may* be an raw value OR a map
func (UnstructuredSpec) OpenAPIDefinition() openapi.OpenAPIDefinition {
	s := schema_pkg_apis_datasource_v0alpha1_GenericDataSourceSpec(func(path string) spec.Ref {
		return spec.MustCreateRef(path)
	})
	s.Schema.AdditionalProperties = &spec.SchemaOrBool{
		Allows: true,
	}
	return s
}

// MarshalJSON ensures that the unstructured object produces proper
// JSON when passed to Go's standard JSON library.
func (u *UnstructuredSpec) MarshalJSON() ([]byte, error) {
	return json.Marshal(u.Object)
}

// UnmarshalJSON ensures that the unstructured object properly decodes
// JSON when passed to Go's standard JSON library.
func (u *UnstructuredSpec) UnmarshalJSON(b []byte) error {
	return json.Unmarshal(b, &u.Object)
}

func (u *UnstructuredSpec) DeepCopy() *UnstructuredSpec {
	if u == nil {
		return nil
	}
	out := new(UnstructuredSpec)
	*out = *u

	tmp := common.Unstructured{Object: u.Object}
	copy := tmp.DeepCopy()
	out.Object = copy.Object
	return out
}

func (u *UnstructuredSpec) DeepCopyInto(out *UnstructuredSpec) {
	clone := u.DeepCopy()
	*out = *clone
}
