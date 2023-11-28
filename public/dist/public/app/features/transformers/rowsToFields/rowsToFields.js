import { map } from 'rxjs/operators';
import { DataTransformerID, getFieldDisplayName } from '@grafana/data';
import { evaluteFieldMappings, FieldConfigHandlerKey, getFieldConfigFromFrame, } from '../fieldToConfigMapping/fieldToConfigMapping';
export const rowsToFieldsTransformer = {
    id: DataTransformerID.rowsToFields,
    name: 'Rows to fields',
    description: 'Convert each row into a field with dynamic config.',
    defaultOptions: {},
    /**
     * Return a modified copy of the series. If the transform is not or should not
     * be applied, just return the input series
     */
    operator: (options) => (source) => source.pipe(map((data) => {
        return data.map((frame) => rowsToFields(options, frame));
    })),
};
export function rowsToFields(options, data) {
    var _a;
    const mappingResult = evaluteFieldMappings(data, (_a = options.mappings) !== null && _a !== void 0 ? _a : [], true);
    const { nameField, valueField } = mappingResult;
    if (!nameField || !valueField) {
        return data;
    }
    const outFields = [];
    for (let index = 0; index < nameField.values.length; index++) {
        const name = nameField.values[index];
        const value = valueField.values[index];
        const config = getFieldConfigFromFrame(data, index, mappingResult);
        const labels = getLabelsFromRow(data, index, mappingResult);
        const field = {
            name: `${name}`,
            type: valueField.type,
            values: [value],
            config: config,
            labels,
        };
        outFields.push(field);
    }
    return {
        fields: outFields,
        length: 1,
    };
}
function getLabelsFromRow(frame, index, mappingResult) {
    const labels = Object.assign({}, mappingResult.nameField.labels);
    for (let i = 0; i < frame.fields.length; i++) {
        const field = frame.fields[i];
        const fieldName = getFieldDisplayName(field, frame);
        const fieldMapping = mappingResult.index[fieldName];
        if (fieldMapping.handler && fieldMapping.handler.key !== FieldConfigHandlerKey.Label) {
            continue;
        }
        const value = field.values[index];
        if (value != null) {
            labels[fieldName] = value;
        }
    }
    return labels;
}
//# sourceMappingURL=rowsToFields.js.map