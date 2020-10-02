import { appendTransformer } from './transformers/append';
import { reduceTransformer } from './transformers/reduce';
import { calculateFieldTransformer } from './transformers/calculateField';
import { filterFieldsTransformer, filterFramesTransformer } from './transformers/filter';
import { filterFieldsByNameTransformer } from './transformers/filterByName';
import { noopTransformer } from './transformers/noop';
import { filterFramesByRefIdTransformer } from './transformers/filterByRefId';
import { orderFieldsTransformer } from './transformers/order';
import { organizeFieldsTransformer } from './transformers/organize';
import { seriesToColumnsTransformer } from './transformers/seriesToColumns';
import { seriesToRowsTransformer } from './transformers/seriesToRows';
import { renameFieldsTransformer } from './transformers/rename';
import { labelsToFieldsTransformer } from './transformers/labelsToFields';
import { ensureColumnsTransformer } from './transformers/ensureColumns';
import { groupByTransformer } from './transformers/groupBy';
import { mergeTransformer } from './transformers/merge';

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
  calculateFieldTransformer,
  seriesToColumnsTransformer,
  seriesToRowsTransformer,
  renameFieldsTransformer,
  labelsToFieldsTransformer,
  ensureColumnsTransformer,
  groupByTransformer,
  mergeTransformer,
};
