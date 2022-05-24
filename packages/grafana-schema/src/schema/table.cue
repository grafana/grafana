package schema

// TODO -- should not be table specific!
FieldTextAlignment: "auto" | "left" | "right" | "center" @cuetsy(kind="type")
GaugeDisplayMode: "basic" | "gradient" | "lcd" @cuetsy(kind="enum", memberNames="Basic|Gradient|RetroLCD") 
BackgroundDisplayMode: "basic" | "gradient"  @cuetsy(kind="enum", memberNames="Basic|Gradient") 

TableCellDisplayMode: "auto" | "color-text" | "color-background" | "gauge" | "json-view" | "image" @cuetsy(kind="enum", memberNames="Auto|ColorText|ColorBackground|Gauge|JSONView|Image")

TableCellOptions: {
	displayMode: TableCellDisplayMode
	gaugeDisplayMode?: GaugeDisplayMode
	backgroundDisplayMode?: BackgroundDisplayMode
} @cuetsy(kind="interface")

TableFieldOptions: {
	width?:      number
	minWidth?:   number
	align:       FieldTextAlignment | *"auto"
	cellOptions: TableCellOptions
	hidden?:     bool // ?? default is missing or false ??
	filterable?: bool
	inspect: bool
} @cuetsy(kind="interface")
