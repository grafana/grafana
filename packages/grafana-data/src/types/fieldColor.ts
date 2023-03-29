/**
 * @public
 */
export enum FieldColorModeId {
  Thresholds = 'thresholds',
  PaletteClassic = 'palette-classic',
  PaletteSaturated = 'palette-saturated',
  ContinuousGrYlRd = 'continuous-GrYlRd',
  ContinuousRdYlGr = 'continuous-RdYlGr',
  ContinuousBlYlRd = 'continuous-BlYlRd',
  ContinuousYlRd = 'continuous-YlRd',
  ContinuousBlPu = 'continuous-BlPu',
  ContinuousYlBl = 'continuous-YlBl',
  ContinuousBlues = 'continuous-blues',
  ContinuousReds = 'continuous-reds',
  ContinuousGreens = 'continuous-greens',
  ContinuousPurples = 'continuous-purples',
  Fixed = 'fixed',
}

/**
 * @public
 */
export interface FieldColor {
  /** The main color scheme mode */
  mode: FieldColorModeId | string;
  /** Stores the fixed color value if mode is fixed */
  fixedColor?: string;
  /** Some visualizations need to know how to assign a series color from by value color schemes */
  seriesBy?: FieldColorSeriesByMode;
}

/**
 * @beta
 */
export type FieldColorSeriesByMode = 'min' | 'max' | 'last';

export const FALLBACK_COLOR = 'gray';
