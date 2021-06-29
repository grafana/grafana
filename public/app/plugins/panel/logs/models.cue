package grafanaschema

import (
    ui "github.com/grafana/grafana/cue/ui:grafanaschema"
)

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    showLabels: bool | *false
                    showTime: bool | *false
                    wrapLogMessage: bool | *false
                    enableLogDetails: bool | *true
                    sortOrder: ui.LogsSortOrder | *ui.LogsSortOrder.Descending
                    dedupStrategy: ui.LogsDedupStrategy | *ui.LogsDedupStrategy.none
                }
            }
        ]
    ]
    migrations: []
}
