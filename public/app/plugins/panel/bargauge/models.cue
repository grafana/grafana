package grafanaschema

import ui "github.com/grafana/grafana/cue/ui:grafanaschema"

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    ui.SingleStatBaseOptions
                    displayMode: ui.BarGaugeDisplayMode
                    showUnfilled: bool
                }
            }
        ]
    ]
    migrations: []
}