// TODO: this should be generated with cue

import { VizLegendOptions, VizTooltipOptions } from '../components';
import { VizTextDisplayOptions } from './builder/text';

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
