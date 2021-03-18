package grafanaschema

import (
    ui "github.com/grafana/grafana/cue/ui:grafanaschema"
)


// TODO remove "Model: " - expect that models.cue has the #PanelModelFamily
// form at the level of the file struct. (An "emit value", in CUE parlance)

Model: {
    seqs: [
        [
            { // v0.0
                PanelOptions: {
                    frameIndex: number | *0
                    showHeader: bool | *true
                    sortBy?: [...ui.TableSortByFieldState]
                }
                PanelFieldConfig: {
                    width?: int
                    align?: string
                    displayMode?: string
                }
            },
            { // v0.1
                seqs[0][0]
                PanelOptions: foo: string | *"foo"
            }
        ],
        [
            { // v1.0
                PanelOptions: {
                    frameIndex: number | *0
                    includeHeader: bool | *true
                    sortBy?: [...ui.TableSortByFieldState]
                }
                PanelFieldConfig: {
                    width?: int
                    align?: string
                    displayMode?: string
                }
            }
        ],
    ]
    migrations: [
        { // maps from v0.1 to v1.0
            // TODO it's not good that the user has to specify these. Should be
            // implicit, since we don't want to allow any actual choice here.
            // But NOT having it also means CUE can't actually tell if the
            // _rel definition makes any sense at all. UGHHH. Would it be
            // better to put these directly on the #Seq?
            from: seqs[0][1]
            to: seqs[1][0]
            rel: {
                PanelOptions: {
                    frameIndex: from.PanelOptions.frameIndex
                    includeHeader: from.PanelOptions.showHeader
                    if from.PanelOptions.sortBy != _|_ {
                        sortBy: from.PanelOptions.sortBy | *null
                    }
                }
                PanelFieldConfig: from.PanelFieldConfig
            }
            result: rel & to
        }
    ]
}
