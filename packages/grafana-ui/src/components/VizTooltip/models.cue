package grafanaschema

TooltipDisplayMode: "single" | "multi" | "none" @cuetsy(targetType="enum")

VizTooltipOptions: {
    mode: TooltipDisplayMode
} @cuetsy(targetType="interface")