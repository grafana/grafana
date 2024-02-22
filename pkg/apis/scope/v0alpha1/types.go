package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Scope struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ScopeSpec `json:"spec,omitempty"`
}

type ScopeSpec struct {
	Title       string        `json:"title"`
	Type        string        `json:"type"`
	Description string        `json:"description"`
	Category    string        `json:"category"`
	Filters     []ScopeFilter `json:"filters"`
}

type ScopeFilter struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Operator string `json:"operator"`
}

type ScopeDashboard struct {
	DashboardUID string `json:"dashboardUid"`
	ScopeUID     string `json:"scopeUid"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ScopeList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Scope `json:"items,omitempty"`
}
