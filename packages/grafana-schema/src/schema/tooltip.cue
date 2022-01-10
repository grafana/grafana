package schema

TooltipDisplayMode: "single" | "multi" | "none" @cuetsy(kind="enum")
SortOrder: "asc" | "desc" | "none" @cuetsy(kind="enum")

VizTooltipOptions: {
	mode: TooltipDisplayMode
	sort: SortOrder
} @cuetsy(kind="interface")
