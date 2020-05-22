import { DataFrame, DataTransformerConfig } from '../types';
import { standardTransformersRegistry } from './standardTransformersRegistry';

/**
 * Apply configured transformations to the input data
 */
export function transformDataFrame(options: DataTransformerConfig[], data: DataFrame[]): DataFrame[] {
  let processed = data;
  for (const config of options) {
    const info = standardTransformersRegistry.get(config.id);

    if (!info) {
      return data;
    }

    const defaultOptions = info.transformation.defaultOptions ?? {};
    const options = { ...defaultOptions, ...config.options };
    const transformer = info.transformation.transformer(options);
    const after = transformer(processed);

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
