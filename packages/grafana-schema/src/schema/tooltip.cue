package schema

TooltipDisplayMode: "single" | "multi" | "none" @cuetsy(kind="enum")

VizTooltipOptions: {
	mode: TooltipDisplayMode
} @cuetsy(kind="interface")
