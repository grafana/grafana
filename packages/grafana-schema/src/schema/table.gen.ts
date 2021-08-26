export interface TableFieldOptions {
  width: number;
  minWidth: number;
  align: FieldTextAlignment;
  displayMode: TableCellDisplayMode;
  hidden?: boolean;
}

export enum TableCellDisplayMode {
  Auto = 'auto',
  ColorText = 'color-text',
  ColorBackground = 'color-background',
  ColorBackgroundSolid = 'color-background-solid',
  GradientGauge = 'gradient-gauge',
  LcdGauge = 'lcd-gauge',
  JSONView = 'json-view',
  BasicGauge = 'basic',
  Image = 'image',
}

export type FieldTextAlignment = 'auto' | 'left' | 'right' | 'center';
