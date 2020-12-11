import { DataFrameFieldIndex } from '@grafana/data';

export enum GraphNGLegendEventMode {
  select = 'select',
  append = 'append',
}

export interface GraphNGLegendEvent {
  fieldIndex: DataFrameFieldIndex;
  mode: GraphNGLegendEventMode;
}
