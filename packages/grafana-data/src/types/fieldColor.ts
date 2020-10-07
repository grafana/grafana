export enum FieldColorModeId {
  Thresholds = 'thresholds',
  ContinousGrYlRd = 'continuous-GrYlRd',
  ContinousBlGrOrRd = 'continuous-BlGrOrRd',
  PaletteClassic = 'palette-classic',
  PaletteSaturated = 'palette-saturated',
  Fixed = 'fixed',
}

export interface FieldColor {
  mode: FieldColorModeId;
  fixedColor?: string;
}

export const FALLBACK_COLOR = 'gray';
