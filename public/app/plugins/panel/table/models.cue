package grafanaschema

import (
    ui "github.com/grafana/grafana/cue/ui:grafanaschema"
)

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    frameIndex: number | *0
                    showHeader: bool | *true
                    sortBy?: [...ui.TableSortByFieldState]
                }
                PanelFieldConfig: {
                    width?: int 
                    align?: *null | string
                    displayMode?: string | *"auto" // TODO? TableCellDisplayMode
                    filterable?: bool
                }
            },
        ]
    ]
    migrations: []
}