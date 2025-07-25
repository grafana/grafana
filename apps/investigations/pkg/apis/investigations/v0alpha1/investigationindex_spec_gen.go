// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Person represents a user profile with basic information
// +k8s:openapi-gen=true
type InvestigationIndexPerson struct {
	// Unique identifier for the user
	Uid string `json:"uid"`
	// Display name of the user
	Name string `json:"name"`
	// URL to user's Gravatar image
	GravatarUrl string `json:"gravatarUrl"`
}

// NewInvestigationIndexPerson creates a new InvestigationIndexPerson object.
func NewInvestigationIndexPerson() *InvestigationIndexPerson {
	return &InvestigationIndexPerson{}
}

// Type definition for investigation summaries
// +k8s:openapi-gen=true
type InvestigationIndexInvestigationSummary struct {
	Title                 string                     `json:"title"`
	CreatedByProfile      InvestigationIndexPerson   `json:"createdByProfile"`
	HasCustomName         bool                       `json:"hasCustomName"`
	IsFavorite            bool                       `json:"isFavorite"`
	OverviewNote          string                     `json:"overviewNote"`
	OverviewNoteUpdatedAt string                     `json:"overviewNoteUpdatedAt"`
	ViewMode              InvestigationIndexViewMode `json:"viewMode"`
	// +listType=atomic
	CollectableSummaries []InvestigationIndexCollectableSummary `json:"collectableSummaries"`
}

// NewInvestigationIndexInvestigationSummary creates a new InvestigationIndexInvestigationSummary object.
func NewInvestigationIndexInvestigationSummary() *InvestigationIndexInvestigationSummary {
	return &InvestigationIndexInvestigationSummary{
		CreatedByProfile:     *NewInvestigationIndexPerson(),
		ViewMode:             *NewInvestigationIndexViewMode(),
		CollectableSummaries: []InvestigationIndexCollectableSummary{},
	}
}

// +k8s:openapi-gen=true
type InvestigationIndexViewMode struct {
	Mode         InvestigationIndexViewModeMode `json:"mode"`
	ShowComments bool                           `json:"showComments"`
	ShowTooltips bool                           `json:"showTooltips"`
}

// NewInvestigationIndexViewMode creates a new InvestigationIndexViewMode object.
func NewInvestigationIndexViewMode() *InvestigationIndexViewMode {
	return &InvestigationIndexViewMode{}
}

// +k8s:openapi-gen=true
type InvestigationIndexCollectableSummary struct {
	Id       string `json:"id"`
	Title    string `json:"title"`
	LogoPath string `json:"logoPath"`
	Origin   string `json:"origin"`
}

// NewInvestigationIndexCollectableSummary creates a new InvestigationIndexCollectableSummary object.
func NewInvestigationIndexCollectableSummary() *InvestigationIndexCollectableSummary {
	return &InvestigationIndexCollectableSummary{}
}

// +k8s:openapi-gen=true
type InvestigationIndexSpec struct {
	// Title of the index, e.g. 'Favorites' or 'My Investigations'
	Title string `json:"title"`
	// The Person who owns this investigation index
	Owner InvestigationIndexPerson `json:"owner"`
	// Array of investigation summaries
	// +listType=atomic
	InvestigationSummaries []InvestigationIndexInvestigationSummary `json:"investigationSummaries"`
}

// NewInvestigationIndexSpec creates a new InvestigationIndexSpec object.
func NewInvestigationIndexSpec() *InvestigationIndexSpec {
	return &InvestigationIndexSpec{
		Owner:                  *NewInvestigationIndexPerson(),
		InvestigationSummaries: []InvestigationIndexInvestigationSummary{},
	}
}

// +k8s:openapi-gen=true
type InvestigationIndexViewModeMode string

const (
	InvestigationIndexViewModeModeCompact InvestigationIndexViewModeMode = "compact"
	InvestigationIndexViewModeModeFull    InvestigationIndexViewModeMode = "full"
)
