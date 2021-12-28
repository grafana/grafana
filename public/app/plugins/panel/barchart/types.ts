import { DataFrame, Field } from '@grafana/data';

export interface BarChartDisplayValues {
  /** When the data can not display, this will be returned */
  warn?: string;

  /** All fields joined */
  aligned: DataFrame;

  /** The fields we can display, first field is X axis */
  viz: DataFrame;

  /** Potentialy color by a field value */
  colorByField?: Field;
}
