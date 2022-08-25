package coremodel

// The slots named and specified in this file are meta-schemas that act as a
// shared contract between Grafana plugins (producers) and coremodel types
// (consumers).
//
// On the consumer side, any coremodel Thema lineage can choose to define a
// standard Thema composition slot that specifies one of these named slots as
// its meta-schema. Such a specification entails that all schemas in any lineage
// placed into that composition slot must adhere to the meta-schema.
//
// On the producer side, Grafana's plugin system enforces that certain plugin
// types are expected to provide Thema lineages for these named slots which
// adhere to the slot meta-schema.
//
// For example, the Panel slot is consumed by the dashboard coremodel, and is
// expected to be produced by panel plugins.
//
// The name given to each slot in this file must be used as the name of the
// slot in the coremodel, and the name of the field under which the lineage
// is provided in a plugin's models.cue file.
//
// Conformance to meta-schema is achieved by Thema's native lineage joinSchema,
// which Thema internals automatically enforce across all schemas in a lineage.

// Meta-schema for the Panel slot, as implemented in Grafana panel plugins.
//
// This is a grouped meta-schema, intended solely for use in composition. Object
// literals conforming to it are not expected to exist.
slots: Panel: {
  // Defines plugin-specific options for a panel that should be persisted. Required,
  // though a panel without any options may specify an empty struct.
  //
  // Currently mapped to #Panel.options within the dashboard schema.
  PanelOptions: {...}
  // Plugin-specific custom field properties. Optional.
  //
  // Currently mapped to #Panel.fieldConfig.defaults.custom within the dashboard schema.
  PanelFieldConfig?: {...}
}

// Meta-schema for the Query slot, as implemented in Grafana datasource plugins.
slots: Query: {...}

// Meta-schema for the DSOptions slot, as implemented in Grafana datasource plugins.
//
// This is a grouped meta-schema, intended solely for use in composition. Object
// literals conforming to it are not expected to exist.
slots: DSOptions: {
  // Normal datasource configuration options.
  Options: {...}
  // Sensitive datasource configuration options that require encryption.
  SecureOptions: {...}
}

// pluginTypeMetaSchema defines which plugin types should use which metaschemas
// as joinSchema for the lineages declared at which paths.
pluginTypeMetaSchema: [string]: {...}
pluginTypeMetaSchema: {
	// Panel plugins are expected to provide a lineage at path Panel conforming to
	// the Panel joinSchema.
	panel: {
		Panel: slots.Panel
	}
	// Datasource plugins are expected to provide lineages at paths Query and
	// DSOptions, conforming to those joinSchemas respectively.
	datasource: {
		Query: slots.Query
		DSOptions: slots.DSOptions
	}
}
