package grafanaschema

import ui "github.com/grafana/grafana/cue/ui:grafanaschema"
// TODO need to import from `grafanaschema`

PanelOptions: {
    frameIndex: number
    showHeader: bool | *true
    sortBy?: ui.TableSortByFieldState
} @cuetsy(targetType="interface")

PanelFieldConfig: {
    width?: int
    align?: string // import from grafana:ui
    displayMode?: string // import from grafana:ui
} @cuetsy(targetType="interface")
