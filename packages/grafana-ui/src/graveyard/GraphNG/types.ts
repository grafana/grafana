import { DataFrameFieldIndex, FieldMatcher } from '@grafana/data';

import { SeriesVisibilityChangeMode } from '../../components/PanelChrome';

/**
 * Event being triggered when the user interact with the Graph legend.
 * @deprecated
 */
export interface GraphNGLegendEvent {
  fieldIndex: DataFrameFieldIndex;
  mode: SeriesVisibilityChangeMode;
}

/** @deprecated */
export interface XYFieldMatchers {
  x: FieldMatcher; // first match
  y: FieldMatcher;
}
