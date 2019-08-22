import { DataFrame } from '../../types/dataFrame';
import { Registry, RegistryItemWithOptions } from '../registry';

export type DataTransformer = (data: DataFrame[]) => DataFrame[];

export interface DataTransformerInfo<TOptions = any> extends RegistryItemWithOptions {
  transformer: (options: TOptions) => DataTransformer;
}

export interface DataTransformerConfig<TOptions = any> {
  id: string;
  options: TOptions;
}

// Transformer that does nothing
export const NoopDataTransformer = (data: DataFrame[]) => data;

/**
 * Apply configured transformations to the input data
 */
export function transformDataFrame(options: DataTransformerConfig[], data: DataFrame[]): DataFrame[] {
  let processed = data;
  for (const config of options) {
    const info = dataTransformers.get(config.id);
    const transformer = info.transformer(config.options);
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

// Initalize the Registry

import { filterTransformer, FilterOptions } from './filter';
import { appendTransformer, AppendOptions } from './append';
import { reduceTransformer, ReduceOptions } from './reduce';

class TransformerRegisry extends Registry<DataTransformerInfo> {
  // ------------------------------------------------------------
  // Helper functions for calling directly from javascript code
  // ------------------------------------------------------------

  append(data: DataFrame[], options?: AppendOptions): DataFrame | undefined {
    return appendTransformer.transformer(options || appendTransformer.defaultOptions)(data)[0];
  }

  filter(data: DataFrame[], options: FilterOptions): DataFrame[] {
    return filterTransformer.transformer(options)(data);
  }

  reduce(data: DataFrame[], options: ReduceOptions): DataFrame[] {
    return reduceTransformer.transformer(options)(data);
  }
}

export const dataTransformers = new TransformerRegisry(() => [filterTransformer, appendTransformer, reduceTransformer]);
