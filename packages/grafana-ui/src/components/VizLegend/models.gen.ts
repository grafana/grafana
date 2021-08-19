//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export type LegendPlacement = 'bottom' | 'right';
export enum LegendDisplayMode {
  Hidden = 'hidden',
  List = 'list',
  Table = 'table',
}
export interface VizLegendOptions {
  calcs: string[];
  displayMode: LegendDisplayMode;
  placement: LegendPlacement;
}
