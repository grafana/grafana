import { DataTransformerID } from '@grafana/data';

/**
 * Transformations registered in this directory, rather than in @grafana/data, that the transform
 * sidecar (scripts/transform-sidecar) also runs. The sidecar bundles their implementations from
 * here and fails at startup if this list and its registry disagree, so this is the one place that
 * says which app-level transformations can run on the server.
 *
 * configFromData and rowsToFields are not here: their field config mapping resolves color names with
 * the viewer's theme (config.theme2 in fieldToConfigMapping), so the server can't produce the same
 * result.
 */
export const SIDECAR_APP_TRANSFORMATION_IDS: readonly string[] = [
  DataTransformerID.heatmap,
  DataTransformerID.joinByLabels,
  DataTransformerID.partitionByValues,
  DataTransformerID.prepareTimeSeries,
  DataTransformerID.smoothing,
  DataTransformerID.timeSeriesTable,
];
