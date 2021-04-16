package grafanaschema

TooltipMode: "single" | "multi" | "none" @cuetsy(targetType="type")

VizTooltipOptions: {
    mode: TooltipMode
} @cuetsy(targetType="interface")