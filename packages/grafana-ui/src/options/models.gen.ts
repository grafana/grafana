// TODO: this should be generated with cue

import { VizLegendOptions, VizTooltipOptions } from '../components';
import { VizTextDisplayOptions } from './builder/text';

/**
 * @alpha
 */
export interface OptionsWithLegend {
  legend: VizLegendOptions;
}

export interface OptionsWithTooltip {
  tooltip: VizTooltipOptions;
}

export interface OptionsWithTextFormatting {
  text?: VizTextDisplayOptions;
}
