package v0alpha1

// This is like the legacy DTO where access and metadata are all returned in a single call
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardWithAccessInfo struct {
	Dashboard `json:",inline"`

	Access DashboardAccess `json:"access"`
}

// +k8s:deepcopy-gen=true
type DashboardAccess struct {
	// Metadata fields
	Slug     string `json:"slug,omitempty"`
	Url      string `json:"url,omitempty"`
	IsPublic bool   `json:"isPublic"`

	// The permissions part
	CanSave                bool                  `json:"canSave"`
	CanEdit                bool                  `json:"canEdit"`
	CanAdmin               bool                  `json:"canAdmin"`
	CanStar                bool                  `json:"canStar"`
	CanDelete              bool                  `json:"canDelete"`
	AnnotationsPermissions *AnnotationPermission `json:"annotationsPermissions"`
}

// +k8s:deepcopy-gen=true
type AnnotationPermission struct {
	Dashboard    AnnotationActions `json:"dashboard"`
	Organization AnnotationActions `json:"organization"`
}

// +k8s:deepcopy-gen=true
type AnnotationActions struct {
	CanAdd    bool `json:"canAdd"`
	CanEdit   bool `json:"canEdit"`
	CanDelete bool `json:"canDelete"`
}
