package grafanaschema

// This file tries to replicate what is currently in:
// dataFrame.ts#FieldConfig
// current go implementation is here:
// https://github.com/grafana/grafana-plugin-sdk-go/blob/master/data/field_config.go#L10

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


} @cuetsy(targetType="interface")




//   /**
//    * The display value for this field.  This supports template variables blank is auto
//    */
//   displayName?: string;

//   /**
//    * 
//    */
//   displayNameFromDS?: string;

//   /**
//    * 
//    */
//   description?: string;

//   path?: string;


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

//   // Alternative to empty string
//   noValue?: string;

//   // Panel Specific Values
//   custom?: TOptions;