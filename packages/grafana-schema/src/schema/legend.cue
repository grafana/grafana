package schema

LegendPlacement: "bottom" | "right" @cuetsy(kind="type")

LegendDisplayMode: "list" | "table" | "hidden" @cuetsy(kind="enum")

VizLegendOptions: {
	displayMode:  LegendDisplayMode
	placement:    LegendPlacement
	width?:       number,
	asTable?:     bool
	isVisible?:   bool
  sortBy?:      string
  sortDesc?:    bool
	calcs:        [...string]
} @cuetsy(kind="interface")
