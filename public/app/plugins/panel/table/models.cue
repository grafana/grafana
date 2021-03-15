package grafanaschema

import ui "github.com/grafana/grafana/cue/ui:grafanaschema"

// TODO remove "Model: " - expect that models.cue has the #PanelModelFamily
// form at the level of the file struct. (An "emit value", in CUE parlance)

Model: #PanelModelFamily & {
    seqs: [
        [
            { // v0.0
                PanelOptions: {
                    frameIndex: number
                    showHeader: bool | *true
                    sortBy?: ui.TableSortByFieldState
                } @cuetsy(targetType="interface")
                PanelFieldConfig: {
                    width?: int
                    align?: string
                    displayMode?: string
                } @cuetsy(targetType="interface")
            },
            { // v0.1
                seqs[0][0]
                PanelOptions: foo: string | *"foo"
            }
        ],
        [
            { // v1.0
                PanelOptions: {
                    frameIndex: number
                    includeHeader: bool | *true
                    sortBy?: ui.TableSortByFieldState
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
            _from: seqs[0][1],
            _to: seqs[1][0],
            _rel: {
                PanelOptions: {
                    frameIndex: _from.PanelOptions.frameIndex
                    includeHeader: _from.PanelOptions.showHeader
                    // TODO how to deal with optional fields in the rel?
                    if (_from.PanelOptions.sortBy) {
                        sortBy: _from.PanelOptions.sortBy 
                    }
                }
                PanelFieldConfig: _from.PanelFieldConfig
            }
        }
    ]
}
