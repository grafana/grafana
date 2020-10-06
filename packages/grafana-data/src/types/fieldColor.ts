export enum FieldColorModeId {
  Thresholds = 'thresholds',
  ContinousGrYlRd = 'continuous-GrYlRd',
  DiscreteClassic = 'discrete-classic',
  DiscreteVibrant = 'discrete-vibrant',
  Fixed = 'fixed',
}

export interface FieldColor {
  mode: FieldColorModeId;
  fixedColor?: string;
}

export const FALLBACK_COLOR = 'gray';
