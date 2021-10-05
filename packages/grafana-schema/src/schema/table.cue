package schema

// TODO -- should not be table specific!
FieldTextAlignment: "auto" | "left" | "right" | "center" @cuetsy(kind="type")

TableCellDisplayMode: "auto" | "color-text" | "color-background" | "gradient-gauge" | "lcd-gauge" | "json-view" | "basic" | "image" @cuetsy(kind="enum",memberNames="Auto|ColorText|ColorBackground|GradientGauge|LcdGauge|JSONView|BasicGauge|Image")

TableFieldOptions: {
	width?:      number
	align:       FieldTextAlignment | *"auto"
	displayMode: TableCellDisplayMode | *"auto"
	hidden?:     bool // ?? default is missing or false ??
} @cuetsy(kind="interface")
