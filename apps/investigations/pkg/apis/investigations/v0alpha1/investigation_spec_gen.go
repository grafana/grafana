// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Person represents a user profile with basic information
// +k8s:openapi-gen=true
type InvestigationPerson struct {
	// Unique identifier for the user
	Uid string `json:"uid"`
	// Display name of the user
	Name string `json:"name"`
	// URL to user's Gravatar image
	GravatarUrl string `json:"gravatarUrl"`
}

// NewInvestigationPerson creates a new InvestigationPerson object.
func NewInvestigationPerson() *InvestigationPerson {
	return &InvestigationPerson{}
}

// Collectable represents an item collected during investigation
// +k8s:openapi-gen=true
type InvestigationCollectable struct {
	Id        string `json:"id"`
	CreatedAt string `json:"createdAt"`
	Title     string `json:"title"`
	Origin    string `json:"origin"`
	Type      string `json:"type"`
	// +listType=atomic
	Queries       []string                   `json:"queries"`
	TimeRange     InvestigationTimeRange     `json:"timeRange"`
	Datasource    InvestigationDatasourceRef `json:"datasource"`
	Url           string                     `json:"url"`
	LogoPath      *string                    `json:"logoPath,omitempty"`
	Note          string                     `json:"note"`
	NoteUpdatedAt string                     `json:"noteUpdatedAt"`
	FieldConfig   string                     `json:"fieldConfig"`
}

// NewInvestigationCollectable creates a new InvestigationCollectable object.
func NewInvestigationCollectable() *InvestigationCollectable {
	return &InvestigationCollectable{
		Queries:    []string{},
		TimeRange:  *NewInvestigationTimeRange(),
		Datasource: *NewInvestigationDatasourceRef(),
	}
}

// TimeRange represents a time range with both absolute and relative values
// +k8s:openapi-gen=true
type InvestigationTimeRange struct {
	From string                            `json:"from"`
	To   string                            `json:"to"`
	Raw  InvestigationV0alpha1TimeRangeRaw `json:"raw"`
}

// NewInvestigationTimeRange creates a new InvestigationTimeRange object.
func NewInvestigationTimeRange() *InvestigationTimeRange {
	return &InvestigationTimeRange{
		Raw: *NewInvestigationV0alpha1TimeRangeRaw(),
	}
}

// DatasourceRef is a reference to a datasource
// +k8s:openapi-gen=true
type InvestigationDatasourceRef struct {
	Uid string `json:"uid"`
}

// NewInvestigationDatasourceRef creates a new InvestigationDatasourceRef object.
func NewInvestigationDatasourceRef() *InvestigationDatasourceRef {
	return &InvestigationDatasourceRef{}
}

// +k8s:openapi-gen=true
type InvestigationViewMode struct {
	Mode         InvestigationViewModeMode `json:"mode"`
	ShowComments bool                      `json:"showComments"`
	ShowTooltips bool                      `json:"showTooltips"`
}

// NewInvestigationViewMode creates a new InvestigationViewMode object.
func NewInvestigationViewMode() *InvestigationViewMode {
	return &InvestigationViewMode{}
}

// spec is the schema of our resource
// +k8s:openapi-gen=true
type InvestigationSpec struct {
	Title                 string              `json:"title"`
	CreatedByProfile      InvestigationPerson `json:"createdByProfile"`
	HasCustomName         bool                `json:"hasCustomName"`
	IsFavorite            bool                `json:"isFavorite"`
	OverviewNote          string              `json:"overviewNote"`
	OverviewNoteUpdatedAt string              `json:"overviewNoteUpdatedAt"`
	// +listType=atomic
	Collectables []InvestigationCollectable `json:"collectables"`
	ViewMode     InvestigationViewMode      `json:"viewMode"`
}

// NewInvestigationSpec creates a new InvestigationSpec object.
func NewInvestigationSpec() *InvestigationSpec {
	return &InvestigationSpec{
		CreatedByProfile: *NewInvestigationPerson(),
		Collectables:     []InvestigationCollectable{},
		ViewMode:         *NewInvestigationViewMode(),
	}
}

// +k8s:openapi-gen=true
type InvestigationV0alpha1TimeRangeRaw struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// NewInvestigationV0alpha1TimeRangeRaw creates a new InvestigationV0alpha1TimeRangeRaw object.
func NewInvestigationV0alpha1TimeRangeRaw() *InvestigationV0alpha1TimeRangeRaw {
	return &InvestigationV0alpha1TimeRangeRaw{}
}

// +k8s:openapi-gen=true
type InvestigationViewModeMode string

const (
	InvestigationViewModeModeCompact InvestigationViewModeMode = "compact"
	InvestigationViewModeModeFull    InvestigationViewModeMode = "full"
)
