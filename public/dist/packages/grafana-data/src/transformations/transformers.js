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
export var standardTransformers = {
    noopTransformer: noopTransformer,
    filterFieldsTransformer: filterFieldsTransformer,
    filterFieldsByNameTransformer: filterFieldsByNameTransformer,
    filterFramesTransformer: filterFramesTransformer,
    filterFramesByRefIdTransformer: filterFramesByRefIdTransformer,
    filterByValueTransformer: filterByValueTransformer,
    orderFieldsTransformer: orderFieldsTransformer,
    organizeFieldsTransformer: organizeFieldsTransformer,
    reduceTransformer: reduceTransformer,
    concatenateTransformer: concatenateTransformer,
    calculateFieldTransformer: calculateFieldTransformer,
    seriesToColumnsTransformer: seriesToColumnsTransformer,
    seriesToRowsTransformer: seriesToRowsTransformer,
    renameFieldsTransformer: renameFieldsTransformer,
    labelsToFieldsTransformer: labelsToFieldsTransformer,
    ensureColumnsTransformer: ensureColumnsTransformer,
    groupByTransformer: groupByTransformer,
    sortByTransformer: sortByTransformer,
    mergeTransformer: mergeTransformer,
    renameByRegexTransformer: renameByRegexTransformer,
    histogramTransformer: histogramTransformer,
    convertFieldTypeTransformer: convertFieldTypeTransformer,
};
//# sourceMappingURL=transformers.js.map