import { DataFrameFieldIndex } from '@grafana/data';

export enum GraphNGLegendEventMode {
  toggleSelection = 'select',
  appendToSelection = 'append',
}

export interface GraphNGLegendEvent {
  fieldIndex: DataFrameFieldIndex;
  mode: GraphNGLegendEventMode;
}
