package dashboard

// Defines values for DashboardGraphTooltip.
const (
	DashboardGraphTooltipN0 DashboardGraphTooltip = 0

	DashboardGraphTooltipN1 DashboardGraphTooltip = 1

	DashboardGraphTooltipN2 DashboardGraphTooltip = 2
)

// Defines values for DashboardStyle.
const (
	DashboardStyleDark DashboardStyle = "dark"

	DashboardStyleLight DashboardStyle = "light"
)

// Defines values for DashboardTimezone.
const (
	DashboardTimezoneBrowser DashboardTimezone = "browser"

	DashboardTimezoneEmpty DashboardTimezone = ""

	DashboardTimezoneUtc DashboardTimezone = "utc"
)

// Defines values for DashboardDashboardCursorSync.
const (
	DashboardDashboardCursorSyncN0 DashboardDashboardCursorSync = 0

	DashboardDashboardCursorSyncN1 DashboardDashboardCursorSync = 1

	DashboardDashboardCursorSyncN2 DashboardDashboardCursorSync = 2
)

// Defines values for DashboardDashboardLinkType.
const (
	DashboardDashboardLinkTypeDashboards DashboardDashboardLinkType = "dashboards"

	DashboardDashboardLinkTypeLink DashboardDashboardLinkType = "link"
)

// Defines values for DashboardFieldColorModeId.
const (
	DashboardFieldColorModeIdContinuousGrYlRd DashboardFieldColorModeId = "continuous-GrYlRd"

	DashboardFieldColorModeIdFixed DashboardFieldColorModeId = "fixed"

	DashboardFieldColorModeIdPaletteClassic DashboardFieldColorModeId = "palette-classic"

	DashboardFieldColorModeIdPaletteSaturated DashboardFieldColorModeId = "palette-saturated"

	DashboardFieldColorModeIdThresholds DashboardFieldColorModeId = "thresholds"
)

// Defines values for DashboardFieldColorSeriesByMode.
const (
	DashboardFieldColorSeriesByModeLast DashboardFieldColorSeriesByMode = "last"

	DashboardFieldColorSeriesByModeMax DashboardFieldColorSeriesByMode = "max"

	DashboardFieldColorSeriesByModeMin DashboardFieldColorSeriesByMode = "min"
)

// Defines values for DashboardGraphPanelType.
const (
	DashboardGraphPanelTypeGraph DashboardGraphPanelType = "graph"
)

// Defines values for DashboardHeatmapPanelType.
const (
	DashboardHeatmapPanelTypeHeatmap DashboardHeatmapPanelType = "heatmap"
)

// Defines values for DashboardMappingType.
const (
	DashboardMappingTypeRange DashboardMappingType = "range"

	DashboardMappingTypeRegex DashboardMappingType = "regex"

	DashboardMappingTypeSpecial DashboardMappingType = "special"

	DashboardMappingTypeValue DashboardMappingType = "value"
)

// Defines values for DashboardPanelRepeatDirection.
const (
	DashboardPanelRepeatDirectionH DashboardPanelRepeatDirection = "h"

	DashboardPanelRepeatDirectionV DashboardPanelRepeatDirection = "v"
)

// Defines values for DashboardRangeMapType.
const (
	DashboardRangeMapTypeRange DashboardRangeMapType = "range"
)

// Defines values for DashboardRegexMapType.
const (
	DashboardRegexMapTypeRegex DashboardRegexMapType = "regex"
)

// Defines values for DashboardRowPanelType.
const (
	DashboardRowPanelTypeRow DashboardRowPanelType = "row"
)

// Defines values for DashboardSpecialValueMapOptionsMatch.
const (
	DashboardSpecialValueMapOptionsMatchFalse DashboardSpecialValueMapOptionsMatch = "false"

	DashboardSpecialValueMapOptionsMatchTrue DashboardSpecialValueMapOptionsMatch = "true"
)

// Defines values for DashboardSpecialValueMapType.
const (
	DashboardSpecialValueMapTypeSpecial DashboardSpecialValueMapType = "special"
)

// Defines values for DashboardSpecialValueMatch.
const (
	DashboardSpecialValueMatchEmpty DashboardSpecialValueMatch = "empty"

	DashboardSpecialValueMatchFalse DashboardSpecialValueMatch = "false"

	DashboardSpecialValueMatchNan DashboardSpecialValueMatch = "nan"

	DashboardSpecialValueMatchNull DashboardSpecialValueMatch = "null"

	DashboardSpecialValueMatchNullNan DashboardSpecialValueMatch = "null+nan"

	DashboardSpecialValueMatchTrue DashboardSpecialValueMatch = "true"
)

// Defines values for DashboardThresholdsConfigMode.
const (
	DashboardThresholdsConfigModeAbsolute DashboardThresholdsConfigMode = "absolute"

	DashboardThresholdsConfigModePercentage DashboardThresholdsConfigMode = "percentage"
)

// Defines values for DashboardThresholdsMode.
const (
	DashboardThresholdsModeAbsolute DashboardThresholdsMode = "absolute"

	DashboardThresholdsModePercentage DashboardThresholdsMode = "percentage"
)

// Defines values for DashboardValueMapType.
const (
	DashboardValueMapTypeValue DashboardValueMapType = "value"
)

// Defines values for DashboardVariableModelType.
const (
	DashboardVariableModelTypeAdhoc DashboardVariableModelType = "adhoc"

	DashboardVariableModelTypeConstant DashboardVariableModelType = "constant"

	DashboardVariableModelTypeCustom DashboardVariableModelType = "custom"

	DashboardVariableModelTypeDatasource DashboardVariableModelType = "datasource"

	DashboardVariableModelTypeInterval DashboardVariableModelType = "interval"

	DashboardVariableModelTypeQuery DashboardVariableModelType = "query"

	DashboardVariableModelTypeSystem DashboardVariableModelType = "system"

	DashboardVariableModelTypeTextbox DashboardVariableModelType = "textbox"
)

// Defines values for DashboardVariableType.
const (
	DashboardVariableTypeAdhoc DashboardVariableType = "adhoc"

	DashboardVariableTypeConstant DashboardVariableType = "constant"

	DashboardVariableTypeCustom DashboardVariableType = "custom"

	DashboardVariableTypeDatasource DashboardVariableType = "datasource"

	DashboardVariableTypeInterval DashboardVariableType = "interval"

	DashboardVariableTypeQuery DashboardVariableType = "query"

	DashboardVariableTypeSystem DashboardVariableType = "system"

	DashboardVariableTypeTextbox DashboardVariableType = "textbox"
)

// Dashboard defines model for dashboard.
type Dashboard struct {
	Annotations *struct {
		// TODO docs
		List []DashboardAnnotationQuery `json:"list"`
	} `json:"annotations,omitempty"`

	// Description of dashboard.
	Description *string `json:"description,omitempty"`

	// Whether a dashboard is editable or not.
	Editable bool `json:"editable"`

	// TODO docs
	FiscalYearStartMonth *int                  `json:"fiscalYearStartMonth,omitempty"`
	GnetId               *string               `json:"gnetId,omitempty"`
	GraphTooltip         DashboardGraphTooltip `json:"graphTooltip"`

	// Unique numeric identifier for the dashboard.
	// TODO must isolate or remove identifiers local to a Grafana instance...?
	Id *int64 `json:"id,omitempty"`

	// TODO docs
	Links *[]DashboardDashboardLink `json:"links,omitempty"`

	// TODO docs
	LiveNow *bool          `json:"liveNow,omitempty"`
	Panels  *[]interface{} `json:"panels,omitempty"`

	// TODO docs
	Refresh *interface{} `json:"refresh,omitempty"`

	// Version of the JSON schema, incremented each time a Grafana update brings
	// changes to said schema.
	// TODO this is the existing schema numbering system. It will be replaced by Thema's themaVersion
	SchemaVersion int `json:"schemaVersion"`

	// Theme of dashboard.
	Style DashboardStyle `json:"style"`

	// Tags associated with dashboard.
	Tags       *[]string `json:"tags,omitempty"`
	Templating *struct {
		// TODO docs
		List []DashboardVariableModel `json:"list"`
	} `json:"templating,omitempty"`

	// Time range for dashboard, e.g. last 6 hours, last 7 days, etc
	Time *struct {
		From string `json:"from"`
		To   string `json:"to"`
	} `json:"time,omitempty"`

	// TODO docs
	// TODO this appears to be spread all over in the frontend. Concepts will likely need tidying in tandem with schema changes
	Timepicker *struct {
		// Whether timepicker is collapsed or not.
		Collapse bool `json:"collapse"`

		// Whether timepicker is enabled or not.
		Enable bool `json:"enable"`

		// Whether timepicker is visible or not.
		Hidden bool `json:"hidden"`

		// Selectable intervals for auto-refresh.
		RefreshIntervals []string `json:"refresh_intervals"`

		// TODO docs
		TimeOptions []string `json:"time_options"`
	} `json:"timepicker,omitempty"`

	// Timezone of dashboard,
	Timezone *DashboardTimezone `json:"timezone,omitempty"`

	// Title of dashboard.
	Title *string `json:"title,omitempty"`

	// Unique dashboard identifier that can be generated by anyone. string (8-40)
	Uid *string `json:"uid,omitempty"`

	// Version of the dashboard, incremented each time the dashboard is updated.
	Version *int `json:"version,omitempty"`

	// TODO docs
	WeekStart *string `json:"weekStart,omitempty"`
}

// DashboardGraphTooltip defines model for Dashboard.GraphTooltip.
type DashboardGraphTooltip int

// Theme of dashboard.
type DashboardStyle string

// Timezone of dashboard,
type DashboardTimezone string

// TODO docs
// FROM: AnnotationQuery in grafana-data/src/types/annotations.ts
type DashboardAnnotationQuery struct {
	BuiltIn int `json:"builtIn"`

	// Datasource to use for annotation.
	Datasource struct {
		Type *string `json:"type,omitempty"`
		Uid  *string `json:"uid,omitempty"`
	} `json:"datasource"`

	// Whether annotation is enabled.
	Enable bool `json:"enable"`

	// Whether to hide annotation.
	Hide *bool `json:"hide,omitempty"`

	// Annotation icon color.
	IconColor *string `json:"iconColor,omitempty"`

	// Name of annotation.
	Name *string `json:"name,omitempty"`

	// Query for annotation data.
	RawQuery *string `json:"rawQuery,omitempty"`
	ShowIn   int     `json:"showIn"`

	// TODO docs
	Target *DashboardAnnotationTarget `json:"target,omitempty"`
	Type   string                     `json:"type"`
}

// TODO docs
type DashboardAnnotationTarget struct {
	Limit    int64    `json:"limit"`
	MatchAny bool     `json:"matchAny"`
	Tags     []string `json:"tags"`
	Type     string   `json:"type"`
}

// 0 for no shared crosshair or tooltip (default).
// 1 for shared crosshair.
// 2 for shared crosshair AND shared tooltip.
type DashboardDashboardCursorSync int

// FROM public/app/features/dashboard/state/DashboardModels.ts - ish
// TODO docs
type DashboardDashboardLink struct {
	AsDropdown  bool                       `json:"asDropdown"`
	Icon        *string                    `json:"icon,omitempty"`
	IncludeVars bool                       `json:"includeVars"`
	KeepTime    bool                       `json:"keepTime"`
	Tags        []string                   `json:"tags"`
	TargetBlank bool                       `json:"targetBlank"`
	Title       string                     `json:"title"`
	Tooltip     *string                    `json:"tooltip,omitempty"`
	Type        DashboardDashboardLinkType `json:"type"`
	Url         *string                    `json:"url,omitempty"`
}

// DashboardDashboardLinkType defines model for DashboardDashboardLink.Type.
type DashboardDashboardLinkType string

// DashboardDynamicConfigValue defines model for dashboard.DynamicConfigValue.
type DashboardDynamicConfigValue struct {
	Id    string       `json:"id"`
	Value *interface{} `json:"value,omitempty"`
}

// TODO docs
type DashboardFieldColor struct {
	// Stores the fixed color value if mode is fixed
	FixedColor *string `json:"fixedColor,omitempty"`

	// The main color scheme mode
	Mode interface{} `json:"mode"`

	// TODO docs
	SeriesBy *DashboardFieldColorSeriesByMode `json:"seriesBy,omitempty"`
}

// TODO docs
type DashboardFieldColorModeId string

// TODO docs
type DashboardFieldColorSeriesByMode string

// DashboardFieldConfig defines model for dashboard.FieldConfig.
type DashboardFieldConfig struct {
	// TODO docs
	Color *DashboardFieldColor `json:"color,omitempty"`

	// custom is specified by the PanelFieldConfig field
	// in panel plugin schemas.
	Custom *map[string]interface{} `json:"custom,omitempty"`

	// Significant digits (for display)
	Decimals *float32 `json:"decimals,omitempty"`

	// Human readable field metadata
	Description *string `json:"description,omitempty"`

	// The display value for this field.  This supports template variables blank is auto
	DisplayName *string `json:"displayName,omitempty"`

	// This can be used by data sources that return and explicit naming structure for values and labels
	// When this property is configured, this value is used rather than the default naming strategy.
	DisplayNameFromDS *string `json:"displayNameFromDS,omitempty"`

	// True if data source field supports ad-hoc filters
	Filterable *bool `json:"filterable,omitempty"`

	// The behavior when clicking on a result
	Links *[]interface{} `json:"links,omitempty"`

	// Convert input values into a display string
	Mappings *[]DashboardValueMapping `json:"mappings,omitempty"`
	Max      *float32                 `json:"max,omitempty"`
	Min      *float32                 `json:"min,omitempty"`

	// Alternative to empty string
	NoValue *string `json:"noValue,omitempty"`

	// An explict path to the field in the datasource.  When the frame meta includes a path,
	// This will default to `${frame.meta.path}/${field.name}
	//
	// When defined, this value can be used as an identifier within the datasource scope, and
	// may be used to update the results
	Path       *string                    `json:"path,omitempty"`
	Thresholds *DashboardThresholdsConfig `json:"thresholds,omitempty"`

	// Numeric Options
	Unit *string `json:"unit,omitempty"`

	// True if data source can write a value to the path.  Auth/authz are supported separately
	Writeable *bool `json:"writeable,omitempty"`
}

// DashboardFieldConfigSource defines model for dashboard.FieldConfigSource.
type DashboardFieldConfigSource struct {
	Defaults struct {
		// TODO docs
		Color *DashboardFieldColor `json:"color,omitempty"`

		// custom is specified by the PanelFieldConfig field
		// in panel plugin schemas.
		Custom *map[string]interface{} `json:"custom,omitempty"`

		// Significant digits (for display)
		Decimals *float32 `json:"decimals,omitempty"`

		// Human readable field metadata
		Description *string `json:"description,omitempty"`

		// The display value for this field.  This supports template variables blank is auto
		DisplayName *string `json:"displayName,omitempty"`

		// This can be used by data sources that return and explicit naming structure for values and labels
		// When this property is configured, this value is used rather than the default naming strategy.
		DisplayNameFromDS *string `json:"displayNameFromDS,omitempty"`

		// True if data source field supports ad-hoc filters
		Filterable *bool `json:"filterable,omitempty"`

		// The behavior when clicking on a result
		Links *[]interface{} `json:"links,omitempty"`

		// Convert input values into a display string
		Mappings *[]DashboardValueMapping `json:"mappings,omitempty"`
		Max      *float32                 `json:"max,omitempty"`
		Min      *float32                 `json:"min,omitempty"`

		// Alternative to empty string
		NoValue *string `json:"noValue,omitempty"`

		// An explict path to the field in the datasource.  When the frame meta includes a path,
		// This will default to `${frame.meta.path}/${field.name}
		//
		// When defined, this value can be used as an identifier within the datasource scope, and
		// may be used to update the results
		Path       *string                    `json:"path,omitempty"`
		Thresholds *DashboardThresholdsConfig `json:"thresholds,omitempty"`

		// Numeric Options
		Unit *string `json:"unit,omitempty"`

		// True if data source can write a value to the path.  Auth/authz are supported separately
		Writeable *bool `json:"writeable,omitempty"`
	} `json:"defaults"`
	Overrides []struct {
		Matcher struct {
			Id      string       `json:"id"`
			Options *interface{} `json:"options,omitempty"`
		} `json:"matcher"`
		Properties []struct {
			Id    string       `json:"id"`
			Value *interface{} `json:"value,omitempty"`
		} `json:"properties"`
	} `json:"overrides"`
}

// DashboardGraphPanel defines model for dashboard.GraphPanel.
type DashboardGraphPanel struct {
	// Support for legacy graph and heatmap panels.
	Type DashboardGraphPanelType `json:"type"`
}

// Support for legacy graph and heatmap panels.
type DashboardGraphPanelType string

// DashboardGridPos defines model for dashboard.GridPos.
type DashboardGridPos struct {
	// Panel
	H int `json:"h"`

	// true if fixed
	Static *bool `json:"static,omitempty"`

	// Panel
	W int `json:"w"`

	// Panel x
	X int `json:"x"`

	// Panel y
	Y int `json:"y"`
}

// DashboardHeatmapPanel defines model for dashboard.HeatmapPanel.
type DashboardHeatmapPanel struct {
	Type DashboardHeatmapPanelType `json:"type"`
}

// DashboardHeatmapPanelType defines model for DashboardHeatmapPanel.Type.
type DashboardHeatmapPanelType string

// TODO docs
type DashboardMappingType string

// DashboardMatcherConfig defines model for dashboard.MatcherConfig.
type DashboardMatcherConfig struct {
	Id      string       `json:"id"`
	Options *interface{} `json:"options,omitempty"`
}

// Dashboard panels. Panels are canonically defined inline
// because they share a version timeline with the dashboard
// schema; they do not evolve independently.
type DashboardPanel struct {
	// The datasource used in all targets.
	Datasource *struct {
		Type *string `json:"type,omitempty"`
		Uid  *string `json:"uid,omitempty"`
	} `json:"datasource,omitempty"`

	// Description.
	Description *string `json:"description,omitempty"`
	FieldConfig struct {
		Defaults struct {
			// TODO docs
			Color *DashboardFieldColor `json:"color,omitempty"`

			// custom is specified by the PanelFieldConfig field
			// in panel plugin schemas.
			Custom *map[string]interface{} `json:"custom,omitempty"`

			// Significant digits (for display)
			Decimals *float32 `json:"decimals,omitempty"`

			// Human readable field metadata
			Description *string `json:"description,omitempty"`

			// The display value for this field.  This supports template variables blank is auto
			DisplayName *string `json:"displayName,omitempty"`

			// This can be used by data sources that return and explicit naming structure for values and labels
			// When this property is configured, this value is used rather than the default naming strategy.
			DisplayNameFromDS *string `json:"displayNameFromDS,omitempty"`

			// True if data source field supports ad-hoc filters
			Filterable *bool `json:"filterable,omitempty"`

			// The behavior when clicking on a result
			Links *[]interface{} `json:"links,omitempty"`

			// Convert input values into a display string
			Mappings *[]DashboardValueMapping `json:"mappings,omitempty"`
			Max      *float32                 `json:"max,omitempty"`
			Min      *float32                 `json:"min,omitempty"`

			// Alternative to empty string
			NoValue *string `json:"noValue,omitempty"`

			// An explict path to the field in the datasource.  When the frame meta includes a path,
			// This will default to `${frame.meta.path}/${field.name}
			//
			// When defined, this value can be used as an identifier within the datasource scope, and
			// may be used to update the results
			Path       *string                    `json:"path,omitempty"`
			Thresholds *DashboardThresholdsConfig `json:"thresholds,omitempty"`

			// Numeric Options
			Unit *string `json:"unit,omitempty"`

			// True if data source can write a value to the path.  Auth/authz are supported separately
			Writeable *bool `json:"writeable,omitempty"`
		} `json:"defaults"`
		Overrides []struct {
			Matcher struct {
				Id      string       `json:"id"`
				Options *interface{} `json:"options,omitempty"`
			} `json:"matcher"`
			Properties []struct {
				Id    string       `json:"id"`
				Value *interface{} `json:"value,omitempty"`
			} `json:"properties"`
		} `json:"overrides"`
	} `json:"fieldConfig"`
	GridPos *DashboardGridPos `json:"gridPos,omitempty"`

	// TODO docs
	Id *int `json:"id,omitempty"`

	// TODO docs
	// TODO tighter constraint
	Interval *string `json:"interval,omitempty"`

	// Panel links.
	// TODO fill this out - seems there are a couple variants?
	Links *[]DashboardDashboardLink `json:"links,omitempty"`

	// TODO docs
	MaxDataPoints *float32 `json:"maxDataPoints,omitempty"`

	// options is specified by the PanelOptions field in panel
	// plugin schemas.
	Options map[string]interface{} `json:"options"`

	// FIXME this almost certainly has to be changed in favor of scuemata versions
	PluginVersion *string `json:"pluginVersion,omitempty"`

	// Name of template variable to repeat for.
	Repeat *string `json:"repeat,omitempty"`

	// Direction to repeat in if 'repeat' is set.
	// "h" for horizontal, "v" for vertical.
	RepeatDirection DashboardPanelRepeatDirection `json:"repeatDirection"`

	// TODO docs
	Tags *[]string `json:"tags,omitempty"`

	// TODO docs
	Targets *[]DashboardTarget `json:"targets,omitempty"`

	// TODO docs - seems to be an old field from old dashboard alerts?
	Thresholds *[]interface{} `json:"thresholds,omitempty"`

	// TODO docs
	// TODO tighter constraint
	TimeFrom *string `json:"timeFrom,omitempty"`

	// TODO docs
	TimeRegions *[]interface{} `json:"timeRegions,omitempty"`

	// TODO docs
	// TODO tighter constraint
	TimeShift *string `json:"timeShift,omitempty"`

	// Panel title.
	Title           *string `json:"title,omitempty"`
	Transformations []struct {
		Id      string                 `json:"id"`
		Options map[string]interface{} `json:"options"`
	} `json:"transformations"`

	// Whether to display the panel without a background.
	Transparent bool `json:"transparent"`

	// The panel plugin type id. May not be empty.
	Type string `json:"type"`
}

// Direction to repeat in if 'repeat' is set.
// "h" for horizontal, "v" for vertical.
type DashboardPanelRepeatDirection string

// TODO docs
type DashboardRangeMap struct {
	Options struct {
		// to and from are `number | null` in current ts, really not sure what to do
		From   int32 `json:"from"`
		Result struct {
			Color *string `json:"color,omitempty"`
			Icon  *string `json:"icon,omitempty"`
			Index *int32  `json:"index,omitempty"`
			Text  *string `json:"text,omitempty"`
		} `json:"result"`
		To int32 `json:"to"`
	} `json:"options"`
	Type DashboardRangeMapType `json:"type"`
}

// DashboardRangeMapType defines model for DashboardRangeMap.Type.
type DashboardRangeMapType string

// TODO docs
type DashboardRegexMap struct {
	Options struct {
		Pattern string `json:"pattern"`
		Result  struct {
			Color *string `json:"color,omitempty"`
			Icon  *string `json:"icon,omitempty"`
			Index *int32  `json:"index,omitempty"`
			Text  *string `json:"text,omitempty"`
		} `json:"result"`
	} `json:"options"`
	Type DashboardRegexMapType `json:"type"`
}

// DashboardRegexMapType defines model for DashboardRegexMap.Type.
type DashboardRegexMapType string

// Row panel
type DashboardRowPanel struct {
	Collapsed bool `json:"collapsed"`

	// Name of default datasource.
	Datasource *struct {
		Type *string `json:"type,omitempty"`
		Uid  *string `json:"uid,omitempty"`
	} `json:"datasource,omitempty"`
	GridPos *DashboardGridPos `json:"gridPos,omitempty"`
	Id      int               `json:"id"`
	Panels  []interface{}     `json:"panels"`

	// Name of template variable to repeat for.
	Repeat *string               `json:"repeat,omitempty"`
	Title  *string               `json:"title,omitempty"`
	Type   DashboardRowPanelType `json:"type"`
}

// DashboardRowPanelType defines model for DashboardRowPanel.Type.
type DashboardRowPanelType string

// TODO docs
type DashboardSpecialValueMap struct {
	Options struct {
		Match   DashboardSpecialValueMapOptionsMatch `json:"match"`
		Pattern string                               `json:"pattern"`
		Result  struct {
			Color *string `json:"color,omitempty"`
			Icon  *string `json:"icon,omitempty"`
			Index *int32  `json:"index,omitempty"`
			Text  *string `json:"text,omitempty"`
		} `json:"result"`
	} `json:"options"`
	Type DashboardSpecialValueMapType `json:"type"`
}

// DashboardSpecialValueMapOptionsMatch defines model for DashboardSpecialValueMap.Options.Match.
type DashboardSpecialValueMapOptionsMatch string

// DashboardSpecialValueMapType defines model for DashboardSpecialValueMap.Type.
type DashboardSpecialValueMapType string

// TODO docs
type DashboardSpecialValueMatch string

// Schema for panel targets is specified by datasource
// plugins. We use a placeholder definition, which the Go
// schema loader either left open/as-is with the Base
// variant of the Dashboard and Panel families, or filled
// with types derived from plugins in the Instance variant.
// When working directly from CUE, importers can extend this
// type directly to achieve the same effect.
type DashboardTarget map[string]interface{}

// TODO docs
type DashboardThreshold struct {
	// TODO docs
	Color string `json:"color"`

	// TODO docs
	// TODO are the values here enumerable into a disjunction?
	// Some seem to be listed in typescript comment
	State *string `json:"state,omitempty"`

	// TODO docs
	// FIXME the corresponding typescript field is required/non-optional, but nulls currently appear here when serializing -Infinity to JSON
	Value *float32 `json:"value,omitempty"`
}

// DashboardThresholdsConfig defines model for dashboard.ThresholdsConfig.
type DashboardThresholdsConfig struct {
	Mode DashboardThresholdsConfigMode `json:"mode"`

	// Must be sorted by 'value', first value is always -Infinity
	Steps []struct {
		// TODO docs
		Color string `json:"color"`

		// TODO docs
		// TODO are the values here enumerable into a disjunction?
		// Some seem to be listed in typescript comment
		State *string `json:"state,omitempty"`

		// TODO docs
		// FIXME the corresponding typescript field is required/non-optional, but nulls currently appear here when serializing -Infinity to JSON
		Value *float32 `json:"value,omitempty"`
	} `json:"steps"`
}

// DashboardThresholdsConfigMode defines model for DashboardThresholdsConfig.Mode.
type DashboardThresholdsConfigMode string

// DashboardThresholdsMode defines model for dashboard.ThresholdsMode.
type DashboardThresholdsMode string

// TODO docs
// FIXME this is extremely underspecfied; wasn't obvious which typescript types corresponded to it
type DashboardTransformation struct {
	Id      string                 `json:"id"`
	Options map[string]interface{} `json:"options"`
}

// TODO docs
type DashboardValueMap struct {
	Options map[string]interface{} `json:"options"`
	Type    DashboardValueMapType  `json:"type"`
}

// DashboardValueMapType defines model for DashboardValueMap.Type.
type DashboardValueMapType string

// TODO docs
type DashboardValueMapping interface{}

// TODO docs
type DashboardValueMappingResult struct {
	Color *string `json:"color,omitempty"`
	Icon  *string `json:"icon,omitempty"`
	Index *int32  `json:"index,omitempty"`
	Text  *string `json:"text,omitempty"`
}

// FROM: packages/grafana-data/src/types/templateVars.ts
// TODO docs
// TODO what about what's in public/app/features/types.ts?
// TODO there appear to be a lot of different kinds of [template] vars here? if so need a disjunction
type DashboardVariableModel struct {
	Label *string                    `json:"label,omitempty"`
	Name  string                     `json:"name"`
	Type  DashboardVariableModelType `json:"type"`
}

// DashboardVariableModelType defines model for DashboardVariableModel.Type.
type DashboardVariableModelType string

// FROM: packages/grafana-data/src/types/templateVars.ts
// TODO docs
// TODO this implies some wider pattern/discriminated union, probably?
type DashboardVariableType string
