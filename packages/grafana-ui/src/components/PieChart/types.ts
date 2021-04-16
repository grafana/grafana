import {
  DataFrame,
  EventBusWithSource,
  FieldConfigSource,
  FieldDisplay,
  InterpolateFunction,
  ReduceDataOptions,
} from '@grafana/data';
import { VizLegendOptions } from '..';

/**
 * @beta
 */
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

/**
 * @beta
 */
export interface PieChartProps {
  height: number;
  width: number;
  pieType: PieChartType;
  displayLabels?: PieChartLabels[];
  useGradients?: boolean;
  onSeriesColorChange?: (label: string, color: string) => void;
  eventBus?: EventBusWithSource;
  legendOptions?: PieChartLegendOptions;
  reduceOptions: ReduceDataOptions;
  fieldConfig: FieldConfigSource<any>;
  replaceVariables: InterpolateFunction;
  data: DataFrame[];
  timeZone?: string;
}

/**
 * @beta
 */
export enum PieChartType {
  Pie = 'pie',
  Donut = 'donut',
}

/**
 * @beta
 */
export enum PieChartLegendValues {
  Value = 'value',
  Percent = 'percent',
}

/**
 * @beta
 */
export enum PieChartLabels {
  Name = 'name',
  Value = 'value',
  Percent = 'percent',
}

/**
 * @beta
 */
export interface PieChartLegendOptions extends VizLegendOptions {
  values: PieChartLegendValues[];
}
