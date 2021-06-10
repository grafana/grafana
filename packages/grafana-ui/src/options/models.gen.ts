// TODO: this should be generated with cue
import { VizLegendOptions, VizTooltipOptions } from '../components';

/**
 * Explicit control for visualization text settings
 * @public
 **/
export interface VizTextDisplayOptions {
  /* Explicit title text size */
  titleSize?: number;
  /* Explicit value text size */
  valueSize?: number;
}

/**
 * @public
 */
export interface OptionsWithLegend {
  legend: VizLegendOptions;
}

/**
 * @public
 */
export interface OptionsWithTooltip {
  tooltip: VizTooltipOptions;
}

/**
 * @public
 */
export interface OptionsWithTextFormatting {
  text?: VizTextDisplayOptions;
}
