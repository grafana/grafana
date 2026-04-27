import { type FieldMatcher } from '@grafana/data';
import { type DataFrameFieldIndex } from '@grafana/data/dataframe';
import { type SeriesVisibilityChangeMode } from '@grafana/ui';

/**
 * Event being triggered when the user interact with the Graph legend.
 */
export interface GraphNGLegendEvent {
  fieldIndex: DataFrameFieldIndex;
  mode: SeriesVisibilityChangeMode;
}

export interface XYFieldMatchers {
  x: FieldMatcher; // first match
  y: FieldMatcher;
}
