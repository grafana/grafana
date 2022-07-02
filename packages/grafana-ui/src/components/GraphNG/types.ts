import { DataFrameFieldIndex, FieldMatcher } from '@grafana/data';

import { SeriesVisibilityChangeMode } from '../PanelChrome';

/**
 * Event being triggered when the user interact with the Graph legend.
 * @alpha
 */
export interface GraphNGLegendEvent {
  fieldIndex: DataFrameFieldIndex;
  mode: SeriesVisibilityChangeMode;
}

/** @alpha */
export interface XYFieldMatchers {
  x: FieldMatcher; // first match
  y: FieldMatcher;
}
