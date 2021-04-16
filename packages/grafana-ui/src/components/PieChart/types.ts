import { DataFrame, FieldConfigSource, FieldDisplay, InterpolateFunction, ReduceDataOptions } from '@grafana/data';
import { VizTooltipOptions } from '../VizTooltip';
import { VizLegendOptions } from '..';

export interface PieChartSvgProps {
  height: number;
  width: number;
  fieldDisplayValues: FieldDisplay[];
  pieType: PieChartType;
  displayLabels?: PieChartLabels[];
  useGradients?: boolean;
  onSeriesColorChange?: (label: string, color: string) => void;
  tooltipOptions: VizTooltipOptions;
}

export interface PieChartProps extends Omit<PieChartSvgProps, 'fieldDisplayValues'> {
  legendOptions?: PieChartLegendOptions;
  tooltipOptions: VizTooltipOptions;
  reduceOptions: ReduceDataOptions;
  fieldConfig: FieldConfigSource<any>;
  replaceVariables: InterpolateFunction;
  data: DataFrame[];
  timeZone?: string;
}

export enum PieChartType {
  Pie = 'pie',
  Donut = 'donut',
}

export enum PieChartLegendValues {
  Value = 'value',
  Percent = 'percent',
}

export enum PieChartLabels {
  Name = 'name',
  Value = 'value',
  Percent = 'percent',
}

export interface PieChartLegendOptions extends VizLegendOptions {
  values: PieChartLegendValues[];
}
