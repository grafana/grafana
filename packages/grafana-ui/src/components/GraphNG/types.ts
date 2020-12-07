import { DataFrame, Field } from '@grafana/data';

export enum GraphNGLegendEventMode {
  select = 'select',
  append = 'append',
}

export interface GraphNGLegendEvent {
  field: Field;
  frame: DataFrame;
  data: DataFrame[];
  mode: GraphNGLegendEventMode;
}
