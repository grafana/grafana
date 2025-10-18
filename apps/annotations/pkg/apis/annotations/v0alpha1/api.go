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

// +k8s:openapi-gen=false
type AnnotationQuery struct {
	From int64 `json:"from,omitempty"` // time range
	To   int64 `json:"to,omitempty"`

	Annotation string `json:"annotation,omitempty"` // The annotation id
	Alert      string `json:"alert,omitempty"`
	Dashboard  string `json:"dashboard,omitempty"`
	PanelID    int64  `json:"panelId,omitempty"` // necessary in the query?
	Creator    string `json:"creator,omitempty"` // the created by identity

	Tags     []string `json:"tags,omitempty"`
	MatchAny bool     `json:"matchAny,omitempty"` // tags should be all or any

	Limit    int64  `json:"limit,omitempty"`
	Continue string `json:"continue,omitempty"`
}

// Minimal annotation backend service
type Service interface {
	// Query with the user in context
	Find(ctx context.Context, query *AnnotationQuery) (*AnnotationList, error)

	// Write annotations -- the set of created values will be returned
	Append(ctx context.Context, items []AnnotationSpec) (*AnnotationList, error)

	// Remove an annotation
	Remove(ctx context.Context, annotation string) error

	// List the top tags in a namespace
	Tags(ctx context.Context) (*TagList, error)
}
