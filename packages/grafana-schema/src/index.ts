/**
 * A library containing most of the static shapes required by Grafana.
 *
 * @packageDocumentation
 */
export * from './veneer/common.types';
export * from './veneer/librarypanel.types';
export * from './index.gen';

/***** OVERRIDES *****/
// TODO: Delete this section along with Hidden --------------------------------------
// override LegendDisplayMode enum to deprecated `hidden`, since
// it is not possible to deprecate individual enum values in Cue.
import { LegendDisplayMode as BaseLegendDisplayMode } from './veneer/common.types';

export enum LegendDisplayMode {
  List = BaseLegendDisplayMode.List,
  Table = BaseLegendDisplayMode.Table,
  /** @deprecated use showLegend: false and omit displayMode */
  Hidden = BaseLegendDisplayMode.Hidden,
}
// ENDTODO --------------------------------------------------------------------------
