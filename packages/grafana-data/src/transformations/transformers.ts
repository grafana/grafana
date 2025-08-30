import { calculateFieldTransformer } from './transformers/calculateField';
import { concatenateTransformer } from './transformers/concat';
import { convertFieldTypeTransformer } from './transformers/convertFieldType';
import { convertFrameTypeTransformer } from './transformers/convertFrameType';
import { ensureColumnsTransformer } from './transformers/ensureColumns';
import { filterFieldsTransformer, filterFramesTransformer } from './transformers/filter';
import { filterFieldsByNameTransformer } from './transformers/filterByName';
import { filterFramesByRefIdTransformer } from './transformers/filterByRefId';
import { filterByValueTransformer } from './transformers/filterByValue';
import { formatStringTransformer } from './transformers/formatString';
import { formatTimeTransformer } from './transformers/formatTime';
import { groupByTransformer } from './transformers/groupBy';
import { groupToNestedTable } from './transformers/groupToNestedTable';
import { groupingToMatrixTransformer } from './transformers/groupingToMatrix';
import { histogramTransformer } from './transformers/histogram';
import { joinByFieldTransformer } from './transformers/joinByField';
import { labelsToFieldsTransformer } from './transformers/labelsToFields';
import { limitTransformer } from './transformers/limit';
import { mergeTransformer } from './transformers/merge';
import { noopTransformer } from './transformers/noop';
import { orderFieldsTransformer } from './transformers/order';
import { organizeFieldsTransformer } from './transformers/organize';
import { reduceTransformer } from './transformers/reduce';
import { renameFieldsTransformer } from './transformers/rename';
import { renameByRegexTransformer } from './transformers/renameByRegex';
import { seriesToRowsTransformer } from './transformers/seriesToRows';
import { sortByTransformer } from './transformers/sortBy';
import { transposeTransformer } from './transformers/transpose';

export const standardTransformers = {
  noopTransformer,
  filterFieldsTransformer,
  filterFieldsByNameTransformer,
  filterFramesTransformer,
  filterFramesByRefIdTransformer,
  filterByValueTransformer,
  formatStringTransformer,
  formatTimeTransformer,
  orderFieldsTransformer,
  organizeFieldsTransformer,
  reduceTransformer,
  concatenateTransformer,
  calculateFieldTransformer,
  joinByFieldTransformer,
  /** @deprecated */
  seriesToColumnsTransformer: joinByFieldTransformer,
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
  limitTransformer,
  groupToNestedTable,
  transposeTransformer,
  convertFrameTypeTransformer,
};
