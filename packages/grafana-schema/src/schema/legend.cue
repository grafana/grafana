package schema

LegendPlacement: "bottom" | "right" @cuetsy(kind="type")

LegendDisplayMode: "list" | "table" | "hidden" @cuetsy(kind="enum")

VizLegendOptions: {
	displayMode: LegendDisplayMode
	placement:   LegendPlacement
	asTable:     bool | *false
	isVisible:   bool | *false
	calcs: [...string]
} @cuetsy(kind="interface")
