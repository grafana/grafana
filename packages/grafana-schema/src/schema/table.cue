package schema

// TODO -- should not be table specific!
FieldTextAlignment: "auto" | "left" | "right" | "center" @cuetsy(targetType="type")

// FIXME can't write enums as structs, must use disjunctions
TableCellDisplayMode: {
	Auto:            "auto"
	ColorText:       "color-text"
	ColorBackground: "color-background"
	GradientGauge:   "gradient-gauge"
	LcdGauge:        "lcd-gauge"
	JSONView:        "json-view"
	BasicGauge:      "basic"
	Image:           "image"
} @cuetsy(targetType="enum")

TableFieldOptions: {
	width?:      number
	align:       FieldTextAlignment | *"auto"
	displayMode: TableCellDisplayMode | *"auto"
	hidden?:     bool // ?? default is missing or false ??
} @cuetsy(targetType="interface")
