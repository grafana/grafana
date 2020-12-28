import { DataFrameFieldIndex } from '@grafana/data';

/**
 * Mode to describe if a legend is isolated/selected or being appended to an existing
 * series selection.
 * @public
 */
export enum GraphNGLegendEventMode {
  ToggleSelection = 'select',
  AppendToSelection = 'append',
}

/**
 * Event being triggered when the user interact with the Graph legend.
 * @public
 */
export interface GraphNGLegendEvent {
  fieldIndex: DataFrameFieldIndex;
  mode: GraphNGLegendEventMode;
}
