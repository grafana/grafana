package grafanaschema

import (
    ui "github.com/grafana/grafana/cue/ui:grafanaschema"
)

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    showLabels: bool | false
                    showTime: bool | false
                    wrapLogMessage: bool | false
                    sortOrder: ui.LogsSortOrder
                    dedupStrategy: ui.LogsDedupStrategy
                }
            }
        ]
    ]
    migrations: []
}
