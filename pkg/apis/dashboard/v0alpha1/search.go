package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SearchResults struct {
	metav1.TypeMeta `json:",inline"`

	// Where the query started from
	Offset int64 `json:"offset,omitempty"`

	// The number of matching results
	TotalHits int64 `json:"totalHits"`

	// The dashboard body (unstructured for now)
	Hits []DashboardHit `json:"hits"`

	// Cost of running the query
	QueryCost float64 `json:"queryCost,omitempty"`

	// Max score
	MaxScore float64 `json:"maxScore,omitempty"`

	// How are the results sorted
	SortBy *SortBy `json:"sortBy,omitempty"`

	// Facet results
	Facets map[string]FacetResult `json:"facets,omitempty"`
}

type SortBy struct {
	Field      string `json:"field"`
	Descending bool   `json:"desc,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SortableFields struct {
	metav1.TypeMeta `json:",inline"`

	// Sortable fields (depends on backend support)
	Fields []metav1.TableColumnDefinition `json:"fields"`
}

// Dashboard or folder hit
// +enum
type HitType string

// PluginType values
const (
	HitTypeDash   HitType = "dash"
	HitTypeFolder HitType = "folder"
)

type DashboardHit struct {
	// Dashboard or folder
	Type HitType `json:"type"`
	// The UID
	Name string `json:"name"`
	// The display nam
	Title string `json:"title"`
	// Filter tags
	Tags []string `json:"tags,omitempty"`
	// The UID/name for the folder
	Folder string `json:"folder,omitempty"`
	// Current sorting supports sort by name, stats and date
	// Name does not need to be returned, and the others can be numbers
	SortValue int64 `json:"sorted,omitempty"`
	// When using "real" search, this is the score
	Score float64 `json:"score,omitempty"`
	// Untyped extra fields/values, useful for dynamic development, but do not count on them
	Extra *common.Unstructured `json:"extra,omitempty"`
	// Explain the score (if possible)
	Explain *common.Unstructured `json:"explain,omitempty"`
}

type FacetResult struct {
	Field string `json:"field,omitempty"`
	// The distinct terms
	Total int64 `json:"total,omitempty"`
	// The number of documents that do *not* have this field
	Missing int64 `json:"missing,omitempty"`
	// Term facets
	Terms []TermFacet `json:"terms,omitempty"`
}

type TermFacet struct {
	Term  string `json:"term,omitempty"`
	Count int64  `json:"count,omitempty"`
}
