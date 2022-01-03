package schema

TooltipDisplayMode: "single" | "multi" | "none" @cuetsy(kind="enum")
TooltipSortOrder: "asc" | "desc" | "none" @cuetsy(kind="enum")

VizTooltipOptions: {
	mode: TooltipDisplayMode
	sortOrder: TooltipSortOrder
} @cuetsy(kind="interface")
