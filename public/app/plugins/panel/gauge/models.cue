package grafanaschema

import ui "github.com/grafana/grafana/cue/ui:grafanaschema"

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    ui.SingleStatBaseOptions
                    showThresholdLabels: bool
                    showThresholdMarkers: bool
                }
            }
        ]
    ]
    migrations: []
}