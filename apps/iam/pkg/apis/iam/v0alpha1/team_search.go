package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TeamSearchResults struct {
	metav1.TypeMeta `json:",inline"`

	// Where the query started from
	Offset int64 `json:"offset,omitempty"`

	// The number of matching results
	TotalHits int64 `json:"totalHits"`

	// The team body
	Hits []TeamHit `json:"hits"`

	// Cost of running the query
	QueryCost float64 `json:"queryCost,omitempty"`

	// Max score
	MaxScore float64 `json:"maxScore,omitempty"`
}

// +k8s:deepcopy-gen=true
type TeamHit struct {
	Name        string `json:"name"`
	Title       string `json:"title"`
	Email       string `json:"email,omitempty"`
	Provisioned bool   `json:"provisioned,omitempty"`
	ExternalUID string `json:"externalUID,omitempty"`
}
