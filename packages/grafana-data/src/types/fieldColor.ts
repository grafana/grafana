export enum FieldColorMode {
  Thresholds = 'thresholds',
  SchemeBlues = 'SchemeBlues',
  SchemeReds = 'SchemeReds',
  SchemeGreens = 'SchemeGreens',
  SchemeGrYlRd = 'SchemeGrYlRd',
  Fixed = 'fixed',
}

export interface FieldColor {
  mode: FieldColorMode;
  fixedColor?: string;
}

export const FALLBACK_COLOR = 'gray';
