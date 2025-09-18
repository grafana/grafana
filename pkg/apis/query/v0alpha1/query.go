package v0alpha1

import (
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkdata "github.com/grafana/grafana-plugin-sdk-go/data"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// Generic query request with shared time across all values
// Copied from: https://github.com/grafana/grafana/blob/main/pkg/api/dtos/models.go#L62
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryDataRequest struct {
	metav1.TypeMeta `json:",inline"`

	// The time range used when not included on each query
	data.QueryDataRequest `json:",inline"`
}

// Wraps backend.QueryDataResponse, however it includes TypeMeta and implements runtime.Object
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryDataResponse struct {
	metav1.TypeMeta `json:",inline"`

	// Backend wrapper (external dependency)
	backend.QueryDataResponse `json:",inline"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SQLSchemaResponse struct {
	metav1.TypeMeta `json:",inline"`

	// Backend wrapper (external dependency)
	SQLSchema `json:",inline"`
}

// BasicColumn represents the column type for data that is input to a SQL expression.
type BasicColumn struct {
	Name               string            `json:"name"`
	MySQLType          string            `json:"mysqlType"`
	Nullable           bool              `json:"nullable"`
	DataFrameFieldType sdkdata.FieldType `json:"dataFrameFieldType"`
}

// SchemaInfo provides information and some sample data for data that could be an input
// to a SQL expression.
type SchemaInfo struct {
	Columns    []BasicColumn           `json:"columns"`
	SampleRows [][]common.Unstructured `json:"sampleRows"`
	Error      string                  `json:"error,omitempty"`
}

// SQLSchema returns info about what the Schema for a DS query will be like if the
// query were to be used an input to SQL expressions. So effectively post SQL expressions input
// conversion.
// There is a a manual DeepCopy at the end of this file that will need to be updated when this our the
// underlying structs are change. The hack script will also need to be run to update the Query service API
// generated types.
type SQLSchema map[string]SchemaInfo

// GetResponseCode return the right status code for the response by checking the responses.
func GetResponseCode(rsp *backend.QueryDataResponse) int {
	if rsp == nil {
		return http.StatusBadRequest // rsp is nil, so we return a 400
	}
	for _, res := range rsp.Responses {
		if res.Error != nil && res.Status != 0 {
			return int(res.Status)
		}

		if res.Error != nil {
			return http.StatusBadRequest // Status is nil but we have an error, so we return a 400
		}
	}
	return http.StatusOK
}

// Defines a query behavior in a datasource.  This is a similar model to a CRD where the
// payload describes a valid query
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTypeDefinition struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec data.QueryTypeDefinitionSpec `json:"spec,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTypeDefinitionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []QueryTypeDefinition `json:"items"`
}
