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
  /**
   * @alpha - experimental categorical palette, gated behind the
   * `dataviz.experimentalColorSchemes` feature toggle and may change or be removed.
   */
  PaletteCategoricalNext = 'palette-categorical-next',
  /**
   * @alpha - experimental categorical palette, gated behind the
   * `dataviz.experimentalColorSchemes` feature toggle and may change or be removed.
   */
  PaletteCategoricalNext2 = 'palette-categorical-next-2',
  /**
   * @alpha - experimental categorical palette, gated behind the
   * `dataviz.experimentalColorSchemes` feature toggle and may change or be removed.
   */
  PaletteCategoricalNext3 = 'palette-categorical-next-3',
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
  /** Reverse the order of the colors in a by value color scheme */
  reverse?: boolean;
  /**
   * How a categorical palette assigns its colors. Defaults to the palette's own assignment.
   * @alpha
   */
  assignment?: FieldColorAssignment;
}

/**
 * @beta
 */
export type FieldColorSeriesByMode = 'min' | 'max' | 'last';

/**
 * How a categorical palette picks a color:
 * - `seriesIndex`: by the position of the series
 * - `seriesName`: by hashing the series name
 * - `value`: by hashing each value, so the same value gets the same color everywhere
 *
 * @alpha
 */
export type FieldColorAssignment = 'seriesIndex' | 'seriesName' | 'value';

export const FALLBACK_COLOR = '#808080';
