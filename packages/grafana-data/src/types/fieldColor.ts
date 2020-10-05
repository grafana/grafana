export enum FieldColorMode {
  Thresholds = 'thresholds',
  SpectrumGrYlRd = 'spectrum-GrYlRd',
  PaletteClassic = 'palette-classic',
  PaletteVibrant = 'palette-vibrant',
  Fixed = 'fixed',
}

export interface FieldColor {
  mode: FieldColorMode;
  fixedColor?: string;
}

export const FALLBACK_COLOR = 'gray';
