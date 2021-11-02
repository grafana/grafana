import { __assign } from "tslib";
import { DataTransformerID } from './ids';
import { getFieldDisplayName } from '../../field/fieldState';
import { map } from 'rxjs/operators';
export var orderFieldsTransformer = {
    id: DataTransformerID.order,
    name: 'Order fields by name',
    description: 'Order fields based on configuration given by user',
    defaultOptions: {
        indexByName: {},
    },
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        return source.pipe(map(function (data) {
            var orderer = createFieldsOrderer(options.indexByName);
            if (!Array.isArray(data) || data.length === 0) {
                return data;
            }
            return data.map(function (frame) { return (__assign(__assign({}, frame), { fields: orderer(frame.fields, data, frame) })); });
        }));
    }; },
};
export var createOrderFieldsComparer = function (indexByName) { return function (a, b) {
    return indexOfField(a, indexByName) - indexOfField(b, indexByName);
}; };
var createFieldsOrderer = function (indexByName) { return function (fields, data, frame) {
    if (!Array.isArray(fields) || fields.length === 0) {
        return fields;
    }
    if (!indexByName || Object.keys(indexByName).length === 0) {
        return fields;
    }
    var comparer = createOrderFieldsComparer(indexByName);
    return fields.sort(function (a, b) { return comparer(getFieldDisplayName(a, frame, data), getFieldDisplayName(b, frame, data)); });
}; };
var indexOfField = function (fieldName, indexByName) {
    if (Number.isInteger(indexByName[fieldName])) {
        return indexByName[fieldName];
    }
    return Number.MAX_SAFE_INTEGER;
};
//# sourceMappingURL=order.js.map