package grafanaschema

import ui "github.com/grafana/grafana/cue/ui:grafanaschema"

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    bucketSize?: int
                    bucketOffset: int | *0
                    combine?: bool
                }

                PanelFieldConfig: {
                    ui.GraphFieldConfig
                }
            }
        ]
    ]
    migrations: []
}
