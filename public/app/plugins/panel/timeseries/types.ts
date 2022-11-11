import { OptionsWithLegend, OptionsWithTimezones, OptionsWithTooltip } from '@grafana/schema';

export interface TimeSeriesOptions extends OptionsWithLegend, OptionsWithTooltip, OptionsWithTimezones {}
