package table // must match the plugin id???

// TODO need to import from `grafanaschema`

PanelOptions: {
    showHeader: bool | *true         `
} @cuetsy(targetType="interface")

PanelFieldConfig: {
    width?: int
    align?: string // import from grafana:ui
    displayMode?: string // import from grafana:ui
} @cuetsy(targetType="interface")
