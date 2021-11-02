import { __assign } from "tslib";
import { map } from 'rxjs/operators';
import { ArrayVector, DataTransformerID, getFieldDisplayName, } from '@grafana/data';
import { getFieldConfigFromFrame, evaluteFieldMappings, FieldConfigHandlerKey, } from '../fieldToConfigMapping/fieldToConfigMapping';
export var rowsToFieldsTransformer = {
    id: DataTransformerID.rowsToFields,
    name: 'Rows to fields',
    description: 'Convert each row into a field with dynamic config',
    defaultOptions: {},
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        return source.pipe(map(function (data) {
            return data.map(function (frame) { return rowsToFields(options, frame); });
        }));
    }; },
};
export function rowsToFields(options, data) {
    var _a;
    var mappingResult = evaluteFieldMappings(data, (_a = options.mappings) !== null && _a !== void 0 ? _a : [], true);
    var nameField = mappingResult.nameField, valueField = mappingResult.valueField;
    if (!nameField || !valueField) {
        return data;
    }
    var outFields = [];
    for (var index = 0; index < nameField.values.length; index++) {
        var name_1 = nameField.values.get(index);
        var value = valueField.values.get(index);
        var config = getFieldConfigFromFrame(data, index, mappingResult);
        var labels = getLabelsFromRow(data, index, mappingResult);
        var field = {
            name: "" + name_1,
            type: valueField.type,
            values: new ArrayVector([value]),
            config: config,
            labels: labels,
        };
        outFields.push(field);
    }
    return {
        fields: outFields,
        length: 1,
    };
}
function getLabelsFromRow(frame, index, mappingResult) {
    var labels = __assign({}, mappingResult.nameField.labels);
    for (var i = 0; i < frame.fields.length; i++) {
        var field = frame.fields[i];
        var fieldName = getFieldDisplayName(field, frame);
        var fieldMapping = mappingResult.index[fieldName];
        if (fieldMapping.handler && fieldMapping.handler.key !== FieldConfigHandlerKey.Label) {
            continue;
        }
        var value = field.values.get(index);
        if (value != null) {
            labels[fieldName] = value;
        }
    }
    return labels;
}
//# sourceMappingURL=rowsToFields.js.map