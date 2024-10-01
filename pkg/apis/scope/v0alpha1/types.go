package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

/*
Please keep pkg/promlib/models/query.go and pkg/promlib/models/scope.go in sync
with this file until this package is out of the grafana/grafana module.
*/

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Scope struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ScopeSpec `json:"spec,omitempty"`
}

type ScopeSpec struct {
	Title       string `json:"title"`
	Description string `json:"description"`

	// +listType=atomic
	Filters []ScopeFilter `json:"filters"`
}

type ScopeFilter struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	// Values is used for operators that require multiple values (e.g. one-of and not-one-of).
	Values   []string       `json:"values,omitempty"`
	Operator FilterOperator `json:"operator"`
}

// Type of the filter operator.
// +enum
type FilterOperator string

// Defines values for FilterOperator.
const (
	FilterOperatorEquals        FilterOperator = "equals"
	FilterOperatorNotEquals     FilterOperator = "not-equals"
	FilterOperatorRegexMatch    FilterOperator = "regex-match"
	FilterOperatorRegexNotMatch FilterOperator = "regex-not-match"
	FilterOperatorOneOf         FilterOperator = "one-of"
	FilterOperatorNotOneOf      FilterOperator = "not-one-of"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ScopeList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Scope `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ScopeDashboardBinding struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ScopeDashboardBindingSpec   `json:"spec,omitempty"`
	Status ScopeDashboardBindingStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ScopeDashboardBindingList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ScopeDashboardBinding `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FindScopeDashboardBindingsResults struct {
	metav1.TypeMeta `json:",inline"`

	Items   []ScopeDashboardBinding `json:"items,omitempty"`
	Message string                  `json:"message,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ScopeNode struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ScopeNodeSpec `json:"spec,omitempty"`
}

type ScopeDashboardBindingSpec struct {
	Dashboard string `json:"dashboard"`
	Scope     string `json:"scope"`
}

// Type of the item.
// +enum
// ScopeDashboardBindingStatus contains derived information about a ScopeDashboardBinding.
type ScopeDashboardBindingStatus struct {
	// DashboardTitle should be populated and update from the dashboard
	DashboardTitle string `json:"dashboardTitle"`

	// Groups is used for the grouping of dashboards that are suggested based
	// on a scope. The source of truth for this information has not been
	// determined yet.
	Groups []string `json:"groups,omitempty"`

	// DashboardTitleConditions is a list of conditions that are used to determine if the dashboard title is valid.
	// +optional
	// +listType=map
	// +listMapKey=type
	DashboardTitleConditions []metav1.Condition `json:"dashboardTitleConditions,omitempty"`

	// DashboardTitleConditions is a list of conditions that are used to determine if the list of groups is valid.
	// +optional
	// +listType=map
	// +listMapKey=type
	GroupsConditions []metav1.Condition `json:"groupsConditions,omitempty"`
}

type NodeType string

// Defines values for ItemType.
const (
	NodeTypeContainer NodeType = "container"
	NodeTypeLeaf      NodeType = "leaf"
)

// Type of the item.
// +enum
type LinkType string

// Defines values for ItemType.
const (
	LinkTypeScope LinkType = "scope"
)

type ScopeNodeSpec struct {
	//+optional
	ParentName string `json:"parentName,omitempty"`

	NodeType NodeType `json:"nodeType"` // container | leaf

	Title              string `json:"title"`
	Description        string `json:"description,omitempty"`
	DisableMultiSelect bool   `json:"disableMultiSelect"`

	LinkType LinkType `json:"linkType,omitempty"` // scope (later more things)
	LinkID   string   `json:"linkId,omitempty"`   // the k8s name
	// ?? should this be a slice of links
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ScopeNodeList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ScopeNode `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FindScopeNodeChildrenResults struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ScopeNode `json:"items,omitempty"`
}
