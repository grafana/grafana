import { forkJoin, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { type DataFrame } from '../types/dataFrame';
import { type PanelData } from '../types/panel';
import { DataTopic } from '../types/query';
import {
  type CustomTransformOperator,
  type DataTransformContext,
  type DataTransformerConfig,
} from '../types/transformations';

import { transformDataFrame } from './transformDataFrame';

type Transformations = Array<DataTransformerConfig | CustomTransformOperator>;

/**
 * Splits a pipeline into the frames it applies to. A config with no topic targets series, which
 * is the overwhelmingly common case. Configs targeting alert states are dropped rather than
 * silently run against series.
 */
function partitionByTopic(transformations: Transformations): [Transformations, Transformations] {
  const series: Transformations = [];
  const annotations: Transformations = [];

  for (const transformation of transformations) {
    // Custom operators are functions and carry no topic, so they target series.
    const topic = typeof transformation === 'function' ? undefined : transformation.topic;

    if (topic == null || topic === DataTopic.Series) {
      series.push(transformation);
    } else if (topic === DataTopic.Annotations) {
      annotations.push(transformation);
    }
  }

  return [series, annotations];
}

/**
 * Transformations are free to move frames between topics (an annotation transformation can emit
 * series frames and vice versa), so the results are re-bucketed by frame metadata rather than by
 * which input they came from. A frame therefore has to carry `meta.dataTopic` to be treated as an
 * annotation — which real annotation frames do, and which matches how the host pipeline buckets.
 */
function bucketByDataTopic(results: DataFrame[][]): { series: DataFrame[]; annotations: DataFrame[] } {
  const series: DataFrame[] = [];
  const annotations: DataFrame[] = [];

  for (const frames of results) {
    for (const frame of frames) {
      if (frame.meta?.dataTopic === DataTopic.Annotations) {
        annotations.push(frame);
      } else {
        series.push(frame);
      }
    }
  }

  return { series, annotations };
}

/**
 * Applies a transformation pipeline to a whole `PanelData`, routing each transformation to the
 * series or annotation frames according to its `topic` and re-bucketing the output.
 *
 * Use this instead of calling `transformDataFrame` directly whenever you hold a `PanelData` — for
 * example in a panel that declares `adHocTransforms` and therefore applies its own pipeline.
 *
 * Template variables are NOT interpolated here. `transformDataFrame` deliberately skips
 * interpolation inside a scene, so callers must pass configs that are already interpolated.
 */
export function transformPanelData(
  transformations: Transformations,
  data: PanelData,
  ctx?: DataTransformContext
): Observable<PanelData> {
  const [seriesTransformations, annotationsTransformations] = partitionByTopic(transformations);

  return forkJoin([
    transformDataFrame(seriesTransformations, data.series, ctx),
    transformDataFrame(annotationsTransformations, data.annotations ?? [], ctx),
  ]).pipe(
    map((results) => {
      const { series, annotations } = bucketByDataTopic(results);

      return {
        ...data,
        series,
        // Preserve "no annotations" rather than turning it into an empty array, which some
        // consumers treat as a meaningful difference.
        annotations: annotations.length > 0 || data.annotations ? annotations : undefined,
      };
    })
  );
}
