import { appendTransformer } from './transformers/append';
import { reduceTransformer } from './transformers/reduce';
import { filterFieldsTransformer, filterFramesTransformer } from './transformers/filter';
import { filterFieldsByNameTransformer } from './transformers/filterByName';
import { noopTransformer } from './transformers/noop';
import { filterFramesByRefIdTransformer } from './transformers/filterByRefId';
import { orderFieldsTransformer } from './transformers/order';
import { organizeFieldsTransformer } from './transformers/organize';
import { seriesToColumnsTransformer } from './transformers/seriesToColumns';
import { renameFieldsTransformer } from './transformers/rename';

export const standardTransformers = {
  noopTransformer,
  filterFieldsTransformer,
  filterFieldsByNameTransformer,
  filterFramesTransformer,
  filterFramesByRefIdTransformer,
  orderFieldsTransformer,
  organizeFieldsTransformer,
  appendTransformer,
  reduceTransformer,
  seriesToColumnsTransformer,
  renameFieldsTransformer,
};
