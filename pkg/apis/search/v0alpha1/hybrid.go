package v0alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// HybridSearchQuery is the request body for POST .../{resource}/search/hybrid.
// It returns the top matching resources, with no pagination, sorting or facets.
//
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type HybridSearchQuery struct {
	metav1.TypeMeta `json:",inline"`

	// Query supplies the lexical query and, unless SemanticQuery is set, the
	// text embedded for semantic search. Required, with a maximum of 1000 bytes.
	Query string `json:"query"`

	// SemanticQuery supplies optional richer phrasing for semantic search.
	// When provided, it must not be whitespace and must fit within 1000 bytes.
	SemanticQuery string `json:"semanticQuery,omitempty"`

	// Filters are ANDed together. Each field may appear once, with at most
	// 1000 values across all filters. Embedding fields supply text only and
	// do not make additional fields available for filtering.
	// +listType=atomic
	Filters []HybridSearchFilter `json:"filters,omitempty"`

	// Limit is the maximum number of results. Zero uses the default of 50,
	// values above 200 are clamped, and negative values are rejected.
	Limit int64 `json:"limit,omitempty"`

	// MinRelevance is lowest, low, medium, high or highest. Empty keeps every
	// result. Filtering is best-effort: no results are dropped when reranking
	// is unavailable or fails. It cannot be combined with SkipRerank.
	MinRelevance string `json:"minRelevance,omitempty"`

	// SkipRerank returns the fused lexical and semantic ordering without
	// reranking, even when a reranker is configured.
	SkipRerank bool `json:"skipRerank,omitempty"`
}

// HybridSearchFilter matches any of Values against Field (IN semantics).
// Unlike lexical search filters, no other operators are supported.
//
// +k8s:deepcopy-gen=true
type HybridSearchFilter struct {
	// Field is uid or folder for all resources. Dashboards additionally
	// support datasource_uid and language (promql, logql, traceql or sql).
	Field string `json:"field"`

	// Values must contain at least one value. An empty folder value matches
	// resources in the root folder.
	// +listType=atomic
	Values []string `json:"values"`
}

// HybridSearchResults is the response body for POST .../{resource}/search/hybrid.
// Items are ordered by relevance. They are a bounded top-k result set, not an
// exhaustive list, so the response carries no total count or pagination token.
//
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type HybridSearchResults struct {
	metav1.TypeMeta `json:",inline"`

	// +listType=atomic
	Items []HybridSearchResultItem `json:"items"`
}

// HybridSearchResultItem is one matching resource, with its matching chunks.
//
// +k8s:deepcopy-gen=true
type HybridSearchResultItem struct {
	Resource ResourceRef `json:"resource"`

	// Score is opaque: higher scores rank first, but scores are meaningful
	// only for ordering within this response. Do not compare scores across
	// queries or treat them as probabilities or distances.
	Score float64 `json:"score"`

	Title string `json:"title"`
	// Folder is the containing folder's UID. Empty and "general" denote the root folder.
	Folder string `json:"folder"`
	// FolderTitle is best-effort display data and can be absent.
	FolderTitle string `json:"folderTitle,omitempty"`
	// ManagedBy is absent for unmanaged resources or when lookup fails.
	ManagedBy *HybridSearchManagedBy `json:"managedBy,omitempty"`

	// Chunks contains matching text, best first. A lexical-only hit has a
	// synthesized chunk containing the resource's title.
	// +listType=atomic
	Chunks []HybridSearchChunk `json:"chunks"`
}

// HybridSearchManagedBy identifies the manager of a returned resource.
//
// +k8s:deepcopy-gen=true
type HybridSearchManagedBy struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

// HybridSearchChunk is matching text from an embedded resource or subresource.
//
// +k8s:deepcopy-gen=true
type HybridSearchChunk struct {
	// Subresource identifies a chunk, for example panel/5. Empty means the
	// whole resource, or a synthesized chunk for a lexical-only hit.
	Subresource string `json:"subresource"`
	Content     string `json:"content"`
}
