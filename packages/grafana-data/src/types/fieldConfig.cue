package grafanaschema

// This file tries to replicate what is currently in:
// dataFrame.ts#FieldConfig
// current go implementation is here:
// https://github.com/grafana/grafana-plugin-sdk-go/blob/master/data/field_config.go#L10

// FieldConfig is probably closed. But.
//
// FieldConfig on timeseries panel is gonna have a well-defined field called
// 'custom,' where we know its shape.
//
// Look at table panel as easiest for getting it all working here. It exercises everything, but with few fields.

//  Every property is optional
//  Plugins may extend this with additional properties. Something like series overrides
FieldConfig: {
    // The display value for this field.  This supports template variables blank is auto
    displayName?: string

    // This can be used by data sources that return and explicit naming structure for values and labels
    // When this property is configured, this value is used rather than the default naming strategy.
    displayNameFromDS?: string

    // Human readable field metadata
    description?: string

    // An explict path to the field in the datasource.  When the frame meta includes a path,
    // This will default to `${frame.meta.path}/${field.name}
    //
    // When defined, this value can be used as an identifier within the datasource scope, and
    // may be used to update the results
    path?: string

    // True if data source can write a value to the path.  Auth/authz are supported separately
    writeable?: bool

    // True if data source field supports ad-hoc filters
    filterable?: bool

    // Numeric Options
    unit?: string

    // Significant digits (for display)
    decimals?: number | *null

    min?: number | null
    max?: number | null

//   // Convert input values into a display string
//   mappings?: ValueMapping[];

//   // Map numeric values to states
//   thresholds?: ThresholdsConfig;

//   // Map values to a display color
//   color?: FieldColor;

//   // Used when reducing field values
//   nullValueMode?: NullValueMode;

//   // The behavior when clicking on a result
//   links?: DataLink[];

  // Alternative to empty string
  noValue?: string

  // Panel Specific Values
  // Can always exist. Valid fields within this are defined by the panel plugin
  // - that's the FieldConfig that comes from the plugin.
  custom?: {} // Can cuetsy make this generic? <T = any>

} @cuetsy(targetType="interface") 

// Defines 
FieldConfigSource: {
  // Defaults applied to all numeric fields
  defaults: FieldConfig // or empty {}

  // Rules to override individual values
  // These are a map of k=>v. Keys MUST only either be labels from FieldConfig,
  // OR from the custom, plugin-defined schema.
  overrides: [...ConfigOverrideRule]
} @cuetsy(targetType="interface")

DynamicConfigValue: {
  id: string | *"" 
  value?: {} // anythign
} @cuetsy(targetType="interface")

MatcherConfig: {
  id: string | *"" 
  options?: {} // anythign
} @cuetsy(targetType="interface")

ConfigOverrideRule: {
  matcher: MatcherConfig
  properties: [...DynamicConfigValue]
} @cuetsy(targetType="interface")

