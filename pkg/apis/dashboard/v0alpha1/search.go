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
	Fields []SortableField `json:"fields"`
}

type SortableField struct {
	Field   string `json:"string,omitempty"`
	Display string `json:"display,omitempty"`
	Type    string `json:"type,omitempty"` // string or number
}

// Dashboard or folder hit
// +enum
type HitKind string

// PluginType values
const (
	HitTypeDash   HitKind = "Dashboard"
	HitTypeFolder HitKind = "Folder"
)

type DashboardHit struct {
	// Dashboard or folder
	Kind HitKind `json:"kind"`
	// The k8s "name" (eg, grafana UID)
	Name string `json:"name"`
	// The display nam
	Title string `json:"title"`
	// Filter tags
	Tags []string `json:"tags,omitempty"`
	// The UID/name for the folder
	Folder string `json:"folder,omitempty"`
	// Stick untyped extra fields in this object (including the sort value)
	Field *common.Unstructured `json:"field,omitempty"`
	// Explain the score (if possible)
	Explain *common.Unstructured `json:"explain,omitempty"`
	// When using "real" search, this is the score
	Score float64 `json:"score,omitempty"`
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
