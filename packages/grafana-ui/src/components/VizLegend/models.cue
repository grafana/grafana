package grafanaschema

LegendPlacement: "bottom" | "right" @cuetsy(targetType="type")
LegendDisplayMode: "list" | "table" | "hidden" @cuetsy(targetType="enum")

VizLegendOptions: {
    displayMode: LegendDisplayMode
    placement: LegendPlacement
    asTable: bool | *false
    isVisible: bool | *false
    calcs: [...string]

} @cuetsy(targetType="interface")

// TODO this excludes all the types that include function definitions