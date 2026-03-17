package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NodeValidation contains validation info for a single node in the expression pipeline.
type NodeValidation struct {
	RefID    string `json:"refID"`
	NodeType string `json:"nodeType"` // "Expression", "Datasource", "Machine Learning"
	CmdType  string `json:"cmdType,omitempty"`
	// +listType=atomic
	DependsOn     []string `json:"dependsOn,omitempty"`     // refIDs this node depends on
	Error         string   `json:"error,omitempty"`         // parse error for this node, if any
	DatasourceUID string   `json:"datasourceUID,omitempty"` // the datasource UID, if a datasource node
}

func (NodeValidation) OpenAPIModelName() string {
	return OpenAPIPrefix + "NodeValidation"
}

// PipelineValidation contains the validation result for an expression pipeline.
type PipelineValidation struct {
	IsValid bool `json:"isValid"`
	// +listType=atomic
	Nodes []NodeValidation `json:"nodes"`
}

func (PipelineValidation) OpenAPIModelName() string {
	return OpenAPIPrefix + "PipelineValidation"
}

// QueryResponseValidation wraps PipelineValidation as a Kubernetes API response object.
//
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryResponseValidation struct {
	metav1.TypeMeta `json:",inline"`

	// Validation result for the expression pipeline
	PipelineValidation `json:"validation,inline"`
}

func (QueryResponseValidation) OpenAPIModelName() string {
	return OpenAPIPrefix + "QueryResponseValidation"
}
