// TODO: this should be generated with cue
import { VizLegendOptions, VizTooltipOptions } from '../components';
import { CandlestickFieldMappings } from '../../../../public/app/plugins/panel/candlestick/types';

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
export interface SemanticFieldsMappings extends CandlestickFieldMappings {}

/**
 * @public
 */
export interface OptionsWithLegend {
  legend: VizLegendOptions;
}

/**
 * @public
 */
export interface OptionsWithSemanticFields {
  semanticFields: SemanticFieldsMappings;
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
