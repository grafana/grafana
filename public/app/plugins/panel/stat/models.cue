package grafanaschema

import ui "github.com/grafana/grafana/cue/ui:grafanaschema"

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    ui.SingleStatBaseOptions
                    graphMode: ui.BigValueGraphMode
                    colorMode: ui.BigValueColorMode
                    justifyMode: ui.BigValueJustifyMode
                    textMode: ui.BigValueTextMode
                }
            }
        ]
    ]
    migrations: []
}