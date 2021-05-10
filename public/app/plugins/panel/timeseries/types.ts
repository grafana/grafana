import { VizTooltipOptions } from '@grafana/ui';
import { OptionsWithLegend } from 'app/features/panel/options/legend';
export interface Options extends OptionsWithLegend {
  tooltipOptions: VizTooltipOptions;
}
