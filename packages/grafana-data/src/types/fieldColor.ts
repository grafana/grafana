/**
 * @public
 */
export enum FieldColorModeId {
  Thresholds = 'thresholds',
  PaletteClassic = 'palette-classic',
  PaletteClassicByName = 'palette-classic-by-name',
  PaletteSaturated = 'palette-saturated',
  /**
   * @alpha - the color blind safe palette is experimental and may be removed or changed
   * as we work towards a GA of improved color blind support.
   */
  PaletteColorblind = 'palette-colorblind',
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
  ContinuousViridis = 'continuous-viridis',
  ContinuousMagma = 'continuous-magma',
  ContinuousPlasma = 'continuous-plasma',
  ContinuousInferno = 'continuous-inferno',
  ContinuousCividis = 'continuous-cividis',
  Fixed = 'fixed',
  Shades = 'shades',
  Gradient = 'gradient',
}

/**
 * @public
 */
export interface FieldColor {
  /** The main color scheme mode */
  mode: FieldColorModeId | string;
  /** Stores the fixed color value if mode is fixed, shades, or gradient (start color) */
  fixedColor?: string;
  /** End color for gradient mode (smallest value). Only used when mode is "gradient". */
  gradientColorTo?: string;
  /** Some visualizations need to know how to assign a series color from by value color schemes */
  seriesBy?: FieldColorSeriesByMode;
}

/**
 * @beta
 */
export type FieldColorSeriesByMode = 'min' | 'max' | 'last';

export const FALLBACK_COLOR = '#808080';
