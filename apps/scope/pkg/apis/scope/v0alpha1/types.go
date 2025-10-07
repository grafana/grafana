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
	Title string `json:"title"`
	// Provides a default path for the scope. This refers to a list of nodes in the selector. This is used to display the title next to the selected scope and expand the selector to the proper path.
	// This will override whichever is selected from in the selector.
	// The path is a list of node ids, starting at the direct parent of the selected node towards the root.
	// +listType=atomic
	DefaultPath []string `json:"defaultPath,omitempty"`

	// +listType=atomic
	Filters []ScopeFilter `json:"filters,omitempty"`
}

type ScopeFilter struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	// Values is used for operators that require multiple values (e.g. one-of and not-one-of).
	// +listType=atomic
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

// Scoped navigation types

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ScopeNavigation struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ScopeNavigationSpec   `json:"spec,omitempty"`
	Status ScopeNavigationStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ScopeNavigationList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ScopeNavigation `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FindScopeNavigationsResults struct {
	metav1.TypeMeta `json:",inline"`

	Items   []ScopeNavigation `json:"items,omitempty"`
	Message string            `json:"message,omitempty"`
}

type ScopeNavigationSpec struct {
	URL   string `json:"url"`
	Scope string `json:"scope"`
}

// Type of the item.
// +enum
// ScopeNavigationStatus contains derived information about a ScopeNavigation.
type ScopeNavigationStatus struct {
	// Title should be populated and update from the dashboard
	Title string `json:"title"`

	// Groups is used for the grouping of dashboards that are suggested based
	// on a scope. The source of truth for this information has not been
	// determined yet.
	Groups []string `json:"groups,omitempty"`

	// TitleConditions is a list of conditions that are used to determine if the title is valid.
	// +optional
	// +listType=map
	// +listMapKey=type
	TitleConditions []metav1.Condition `json:"titleConditions,omitempty"`

	// GroupsConditions is a list of conditions that are used to determine if the list of groups is valid.
	// +optional
	// +listType=map
	// +listMapKey=type
	GroupsConditions []metav1.Condition `json:"groupsConditions,omitempty"`
}

// Type of the filter operator.
// +enum
type ScopeNavigationLinkType string

// Defines values for FilterOperator.
const (
	ScopeNavigationLinkTypeURL ScopeNavigationLinkType = "url"
)
