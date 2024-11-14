import { DataFrame, Field } from '@grafana/data';

export interface BarChartDisplayValues {
  /** All fields joined */
  aligned: DataFrame;

  /**
   * The fields we can display, first field is X axis.
   * This needs to be an array to avoid extra re-initialization in GraphNG
   */
  viz: [DataFrame];

  /**
   * The fields we can display, first field is X axis.
   * Contains same data as viz, but without config modifications (e.g: unit override)
   */
  legend: DataFrame;

  /** Potentialy color by a field value */
  colorByField?: Field;
}

export interface BarChartDisplayWarning {
  /** When the data can not display, this will be returned */
  warn: string;
}
