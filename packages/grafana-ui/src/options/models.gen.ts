// TODO: this should be generated with cue

import { VizLegendOptions, VizTooltipOptions } from '../components';
import { VizValueFormattingOptions } from './builder/valueFormatting';

/**
 * @alpha
 */
export interface OptionsWithLegend {
  legend: VizLegendOptions;
}

export interface OptionsWithTooltip {
  tooltip: VizTooltipOptions;
}

export interface OptionsWithValueFormatting {
  valueFormatting: VizValueFormattingOptions;
}
