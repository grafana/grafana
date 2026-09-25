package search

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
)

type Backend interface {
	Search(context.Context, *Query) (*Result, error)
}

type Query struct {
	Namespace    string
	Primary      schema.GroupResource
	Federated    []schema.GroupResource
	Limit        int64
	Offset       int64
	Fields       []string
	Text         string
	Filters      []*searchv0.FilterPredicate
	GroupFilters []metav1.LabelSelectorRequirement
	Sort         []searchv0.SortField
	// The existing routes differ in title matching, ordering, and status projection.
	PerKind bool
}

type Result struct {
	Hits           []Hit
	TotalHits      int64
	TotalHitsExact bool
}

type Hit struct {
	Name   string
	Values map[string]any
}
