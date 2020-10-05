export enum FieldColorMode {
  Thresholds = 'thresholds',
  SchemeGrYlRd = 'SchemeGrYlRd',
  Fixed = 'fixed',
}

export interface FieldColor {
  mode: FieldColorMode;
  fixedColor?: string;
}

export const FALLBACK_COLOR = 'gray';
