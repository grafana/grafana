import { reduceTransformer } from './transformers/reduce';
import { concatenateTransformer } from './transformers/concat';
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
import { sortByTransformer } from './transformers/sortBy';
import { mergeTransformer } from './transformers/merge';
import { renameByRegexTransformer } from './transformers/renameByRegex';
import { filterByValueTransformer } from './transformers/filterByValue';
import { histogramTransformer } from './transformers/histogram';
import { convertFieldTypeTransformer } from './transformers/convertFieldType';
import { groupingToMatrixTransformer } from './transformers/groupingToMatrix';

export const standardTransformers = {
  noopTransformer,
  filterFieldsTransformer,
  filterFieldsByNameTransformer,
  filterFramesTransformer,
  filterFramesByRefIdTransformer,
  filterByValueTransformer,
  orderFieldsTransformer,
  organizeFieldsTransformer,
  reduceTransformer,
  concatenateTransformer,
  calculateFieldTransformer,
  seriesToColumnsTransformer,
  seriesToRowsTransformer,
  renameFieldsTransformer,
  labelsToFieldsTransformer,
  ensureColumnsTransformer,
  groupByTransformer,
  sortByTransformer,
  mergeTransformer,
  renameByRegexTransformer,
  histogramTransformer,
  convertFieldTypeTransformer,
  groupingToMatrixTransformer,
};
