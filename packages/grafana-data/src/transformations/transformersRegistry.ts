import { DataFrame } from '../types/dataFrame';
import { Registry } from '../utils/registry';
// Initalize the Registry

import { appendTransformer, AppendOptions } from './transformers/append';
import { reduceTransformer, ReduceTransformerOptions } from './transformers/reduce';
import { filterFieldsTransformer, filterFramesTransformer } from './transformers/filter';
import { filterFieldsByNameTransformer, FilterFieldsByNameTransformerOptions } from './transformers/filterByName';
import { noopTransformer } from './transformers/noop';
import { DataTransformerInfo } from '../types/transformations';

/**
 * Registry of transformation options that can be driven by
 * stored configuration files.
 */
class TransformerRegistry extends Registry<DataTransformerInfo> {
  // ------------------------------------------------------------
  // Nacent options for more functional programming
  // The API to these functions should change to match the actual
  // needs of people trying to use it.
  //  filterFields|Frames is left off since it is likely easier to
  //  support with `frames.filter( f => {...} )`
  // ------------------------------------------------------------

  append(data: DataFrame[], options?: AppendOptions): DataFrame | undefined {
    return appendTransformer.transformer(options || appendTransformer.defaultOptions)(data)[0];
  }

  reduce(data: DataFrame[], options: ReduceTransformerOptions): DataFrame[] {
    return reduceTransformer.transformer(options)(data);
  }
}

export const transformersRegistry = new TransformerRegistry(() => [
  noopTransformer,
  filterFieldsTransformer,
  filterFieldsByNameTransformer,
  filterFramesTransformer,
  appendTransformer,
  reduceTransformer,
]);

export { ReduceTransformerOptions, FilterFieldsByNameTransformerOptions };
