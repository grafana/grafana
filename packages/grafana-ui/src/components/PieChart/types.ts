import {
  DataFrame,
  EventBus,
  FieldConfigSource,
  FieldDisplay,
  InterpolateFunction,
  ReduceDataOptions,
} from '@grafana/data';
import { VizLegendOptions } from '..';

export interface PieChartSvgProps {
  height: number;
  width: number;
  fieldDisplayValues: FieldDisplay[];
  pieType: PieChartType;
  highlightedTitle?: string;
  displayLabels?: PieChartLabels[];
  useGradients?: boolean;
  onSeriesColorChange?: (label: string, color: string) => void;
}

export interface PieChartProps {
  height: number;
  width: number;
  pieType: PieChartType;
  displayLabels?: PieChartLabels[];
  useGradients?: boolean;
  onSeriesColorChange?: (label: string, color: string) => void;
  eventBus?: EventBus;
  legendOptions?: PieChartLegendOptions;
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
