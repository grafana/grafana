package grafanaschema

import (
    ui "github.com/grafana/grafana/cue/ui:grafanaschema"
)

// TODO remove "Model: " - expect that models.cue has the #PanelModelFamily
// form at the level of the file struct. (An "emit value", in CUE parlance)

// "Model" is an instance of our #PanelScuemata type. It ensures some key
// invariants:
//
//   - seqs is an array of arrays. Outer array is major version, inner is minor.
//     (This IS NOT semver, though.)
//   - Within a single seq, each successive schema is backwards compatible with
//     the prior schema. (See, it's not semver. No special rules for v0.)
//   - For each seq/major version after the first, there exists a migration
//     that allows us to transform a resource compliant with the old version of
//     the schema into one compliant with the new one.
//
// That's right, we've schematized our schema declarations. (Not all above
// invariants are enforced right now, but they will be before launch.)
//
// Grafana won't need to rely on multiple versions of schema until after this
// system is released with Grafana 8. But we'll need it as soon as Grafana 8 is
// released - especially for plugins, which have their own cycle, and could need
// to make breaking changes very shortly after release - so we have to put it in
// place now.
Model: {
    seqs: [
        [
            { // v0.0. The actual schema is the contents of this struct.
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
            { // v0.1
                seqs[0][0]
                PanelOptions: foo: string | *"foo"
            }
        ],
        [
            { // v1.0 - breaking changes vs. v0.1 in this struct.
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
