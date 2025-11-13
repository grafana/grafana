/**
 * @public
 */
export enum FieldColorModeId {
  Thresholds = 'thresholds',
  PaletteClassic = 'palette-classic',
  PaletteClassicByName = 'palette-classic-by-name',
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
  Shades = 'shades',
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
 * Defines how to assign a series color from "by value" color schemes.
 * For example for an aggregated data points like a timeseries, the color can be
 * assigned by the min, max, last, or any other reducer value.
 */
export type FieldColorSeriesByMode =
  | 'last'
  | 'lastNotNull'
  | 'first'
  | 'firstNotNull'
  | 'min'
  | 'max'
  | 'mean'
  | 'sum'
  | 'count'
  | 'range'
  | 'delta'
  | 'step'
  | 'diff'
  | 'logmin'
  | 'allIsZero'
  | 'allIsNull'
  | 'changeCount'
  | 'distinctCount'
  | 'diffperc'
  | 'allValues'
  | 'uniqueValues'
  | 'median'
  | 'variance'
  | 'stdDev'
  | 'countAll'
  | 'p1'
  | 'p2'
  | 'p3'
  | 'p4'
  | 'p5'
  | 'p6'
  | 'p7'
  | 'p8'
  | 'p9'
  | 'p10'
  | 'p11'
  | 'p12'
  | 'p13'
  | 'p14'
  | 'p15'
  | 'p16'
  | 'p17'
  | 'p18'
  | 'p19'
  | 'p20'
  | 'p21'
  | 'p22'
  | 'p23'
  | 'p24'
  | 'p25'
  | 'p26'
  | 'p27'
  | 'p28'
  | 'p29'
  | 'p30'
  | 'p31'
  | 'p32'
  | 'p33'
  | 'p34'
  | 'p35'
  | 'p36'
  | 'p37'
  | 'p38'
  | 'p39'
  | 'p40'
  | 'p41'
  | 'p42'
  | 'p43'
  | 'p44'
  | 'p45'
  | 'p46'
  | 'p47'
  | 'p48'
  | 'p49'
  | 'p50'
  | 'p51'
  | 'p52'
  | 'p53'
  | 'p54'
  | 'p55'
  | 'p56'
  | 'p57'
  | 'p58'
  | 'p59'
  | 'p60'
  | 'p61'
  | 'p62'
  | 'p63'
  | 'p64'
  | 'p65'
  | 'p66'
  | 'p67'
  | 'p68'
  | 'p69'
  | 'p70'
  | 'p71'
  | 'p72'
  | 'p73'
  | 'p74'
  | 'p75'
  | 'p76'
  | 'p77'
  | 'p78'
  | 'p79'
  | 'p80'
  | 'p81'
  | 'p82'
  | 'p83'
  | 'p84'
  | 'p85'
  | 'p86'
  | 'p87'
  | 'p88'
  | 'p89'
  | 'p90'
  | 'p91'
  | 'p92'
  | 'p93'
  | 'p94'
  | 'p95'
  | 'p96'
  | 'p97'
  | 'p98'
  | 'p99';

export const FALLBACK_COLOR = '#808080';
