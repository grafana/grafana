import { SeriesData } from '../../types/data';
import { DataQueryRequest } from '../../types/index';
import { Extension, ExtensionRegistry } from '../extensions';

export type SeriesTransformer = (series: SeriesData[], request?: DataQueryRequest) => SeriesData[];

export interface SeriesTransformerInfo<TOptions = any> extends Extension<TOptions> {
  transformer: (options: TOptions) => SeriesTransformer;
}

export interface SeriesTransformerConfig<TOptions = any> {
  id: string;
  options: TOptions;
}

// Transformer that does nothing
export const NoopSeriesTransformer = (series: SeriesData[], request?: DataQueryRequest) => series;

/**
 * Apply configured transformations to the input data
 */
export function transformSeriesData(
  options: SeriesTransformerConfig[],
  series: SeriesData[],
  request?: DataQueryRequest
): SeriesData[] {
  let processed = series;
  for (const config of options) {
    const info = seriesTransformers.get(config.id);
    const transformer = info.transformer(config.options);
    const after = transformer(processed, request);

    // Add a key to the metadata if the data changed
    if (after && after !== processed) {
      for (const series of after) {
        if (!series.meta) {
          series.meta = {};
        }
        if (!series.meta.transformations) {
          series.meta.transformations = [info.id];
        } else {
          series.meta.transformations = [...series.meta.transformations, info.id];
        }
      }
      processed = after;
    }
  }
  return processed;
}

// Initalize the Registry

import { filterTransformer } from './filter';
import { appendTransformer } from './append';
import { calcTransformer } from './calc';

export const seriesTransformers = new ExtensionRegistry<SeriesTransformerInfo>(() => [
  filterTransformer,
  appendTransformer,
  calcTransformer,
]);
