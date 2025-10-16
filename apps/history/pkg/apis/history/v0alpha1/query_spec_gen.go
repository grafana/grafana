// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type QueryQueryInfo struct {
	RefId      string             `json:"refId"`
	Datasource QueryDataSourceRef `json:"datasource"`
	// the
	Properties interface{} `json:"properties"`
}

// NewQueryQueryInfo creates a new QueryQueryInfo object.
func NewQueryQueryInfo() *QueryQueryInfo {
	return &QueryQueryInfo{
		Datasource: *NewQueryDataSourceRef(),
	}
}

// +k8s:openapi-gen=true
type QueryDataSourceRef struct {
	// same as pluginId
	Group string `json:"group"`
	// apiversion
	Version string `json:"version"`
	// same as grafana uid
	Name string `json:"name"`
}

// NewQueryDataSourceRef creates a new QueryDataSourceRef object.
func NewQueryDataSourceRef() *QueryDataSourceRef {
	return &QueryDataSourceRef{}
}

// +k8s:openapi-gen=true
type QuerySpec struct {
	Comment *string          `json:"comment,omitempty"`
	Queries []QueryQueryInfo `json:"queries"`
}

// NewQuerySpec creates a new QuerySpec object.
func NewQuerySpec() *QuerySpec {
	return &QuerySpec{
		Queries: []QueryQueryInfo{},
	}
}
