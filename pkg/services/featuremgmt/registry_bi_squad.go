package featuremgmt

var (
	biSquadToggles = []FeatureToggle{
		{
			Name:         "editPanelCSVDragAndDrop",
			Description:  "Enables drag and drop for CSV and Excel files",
			FrontendOnly: true,
			State:        FeatureStateAlpha,
		},
		{
			Name:         "drawerDataSourcePicker",
			Description:  "Changes the user experience for data source selection to a drawer.",
			State:        FeatureStateAlpha,
			FrontendOnly: true,
		},
	}
)
