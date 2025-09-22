package v0alpha1

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:openapi-gen=true
type TagCount struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}

// +k8s:openapi-gen=true
type TagList struct {
	metav1.TypeMeta `json:",inline" yaml:",inline"`
	metav1.ListMeta `json:"metadata" yaml:"metadata"`
	Items           []TagCount `json:"items" yaml:"items"`
}

// NOTE this query is done with a user in context that must be namespaced
// +k8s:openapi-gen=true
type ItemQuery struct {
	From         int64    `json:"from"` // time range
	To           int64    `json:"to"`
	AlertUID     string   `json:"alertUID"`
	DashboardUID string   `json:"dashboardUID"`
	PanelID      int64    `json:"panelId"` // necessary in the query?
	Tags         []string `json:"tags"`
	MatchAny     bool     `json:"matchAny"` // tags should be all or any

	Limit int64 `json:"limit"`
	Page  int64
}

// Minimal service used by alerting
type BasicService interface {
	// Query with the user in context
	Find(ctx context.Context, query *ItemQuery) (*AnnotationList, error)

	// Write new annotations with the user in context
	SaveMany(ctx context.Context, items []AnnotationSpec) error

	// List the top tags in a namespace
	Tags(ctx context.Context) (*TagList, error)
}
