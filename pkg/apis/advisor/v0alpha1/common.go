package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type GenericCheck struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   CheckSpec   `json:"spec,omitempty"`
	Status CheckStatus `json:"status,omitempty"`
}

type CheckSpec struct {
	// Data is currently unused but this can be used to add user inputs to the check.
	Data map[string]string `json:"data"`
}

type CheckError struct {
	Type   string `json:"type"`   // Investigation or Action recommended
	Reason string `json:"reason"` // Why the check is failing
	Action string `json:"action"` // Call to action
}

type CheckStatus struct {
	Count  int          `json:"count"`  // Number of Datasources analyzed
	Errors []CheckError `json:"errors"` // List of errors found
}
