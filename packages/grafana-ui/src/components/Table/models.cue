package grafanaschema

FieldTextAlignment: "auto" | "left" | "right" | "center" @cuetsy(targetType="type")

TableCellDisplayMode: 
    "auto" | 
    "color-text" | 
    "color-background" | 
    "gradient-gauge"  |
    "lcd-gauge"  |
    "json-view"  |
    "basic"  | // hymmm >> BasicGauge
    "image"   
    @cuetsy(targetType="enum")

// NOTE: enum should make upper case and remove '-'
//
// export enum TableCellDisplayMode {
//   Auto = 'auto',
//   ColorText = 'color-text',
//   ColorBackground = 'color-background',
//   GradientGauge = '',
//   LcdGauge = '',
//   JSONView = '',
//   BasicGauge = 'basic',
//   Image = 'image',
// }


TableFieldOptions: {
  width?: number
  align: FieldTextAlignment | *"auto"
  displayMode: TableCellDisplayMode | *"auto"
  hidden?: bool  // ?? default is missing or false ??
} @cuetsy(targetType="interface")
