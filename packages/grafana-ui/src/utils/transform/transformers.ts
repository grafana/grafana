import { SeriesData } from '../../types/data';
import { DataQueryRequest } from '../../types/index';
import { Extension, ExtensionRegistry } from '../extensions';

export interface SeriesTransformer<TOptions = any> extends Extension<TOptions> {
  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transform: (options: TOptions, series: SeriesData[], request?: DataQueryRequest) => SeriesData[];
}

export interface SeriesTransformerConfig<TOptions = any> {
  id: string;
  options: TOptions;
}

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
    const transformer = seriesTransformers.get(config.id);
    const after = transformer.transform(config.options, processed);

    // Add a key to the metadata if the data changed
    if (after && after !== processed) {
      for (const series of after) {
        if (!series.meta) {
          series.meta = {};
        }
        series.meta.transformations = [...series.meta.transformations, transformer.id];
      }
      processed = after;
    }
  }
  return processed;
}

export const seriesTransformers = new ExtensionRegistry<SeriesTransformer>();
