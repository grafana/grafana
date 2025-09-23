package dashboard

// Information about how the requesting user can use a given dashboard
type DashboardAccess struct {
	// Metadata fields
	Slug string `json:"slug,omitempty"`
	Url  string `json:"url,omitempty"`

	// The permissions part
	CanSave                bool                  `json:"canSave"`
	CanEdit                bool                  `json:"canEdit"`
	CanAdmin               bool                  `json:"canAdmin"`
	CanStar                bool                  `json:"canStar"`
	CanDelete              bool                  `json:"canDelete"`
	AnnotationsPermissions *AnnotationPermission `json:"annotationsPermissions"`
}

type AnnotationPermission struct {
	Dashboard    AnnotationActions `json:"dashboard"`
	Organization AnnotationActions `json:"organization"`
}

type AnnotationActions struct {
	CanAdd    bool `json:"canAdd"`
	CanEdit   bool `json:"canEdit"`
	CanDelete bool `json:"canDelete"`
}
