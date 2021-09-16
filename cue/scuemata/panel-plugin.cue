package scuemata

// Definition of the shape of a panel plugin's schema declarations in its
// schema.cue file.
//
// Note that these keys do not appear directly in any real JSON artifact;
// rather, they are composed into panel structures as they are defined within
// the larger Dashboard schema.
#PanelSchema: {
    // Defines plugin specific options for a panel
    PanelOptions: {...} @cuetsy(kind="interface")

    // Define the custom properties that exist within standard field config
    PanelFieldConfig?: {...} @cuetsy(kind="interface")

    // Panels may define their own types
    ...
}

// A lineage of panel schema
#PanelLineage: [#PanelSchema, ...#PanelSchema]

// Panel plugin-specific Family
#PanelFamily: {
    lineages: [#PanelLineage, ...#PanelLineage]
    migrations: [...#Migration]
}
