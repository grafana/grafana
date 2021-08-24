//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * @public
 */
export type LegendPlacement = 'bottom' | 'right';

/**
 * @public
 */
export enum LegendDisplayMode {
  Hidden = 'hidden',
  List = 'list',
  Table = 'table',
}

/**
 * @public
 */
export interface VizLegendOptions {
  calcs: string[];
  displayMode: LegendDisplayMode;
  placement: LegendPlacement;
}

/**
 * @public
 */
export interface OptionsWithLegend {
  legend: VizLegendOptions;
}
