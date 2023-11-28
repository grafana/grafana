import { map } from 'rxjs/operators';
import { DataTransformerID, FieldMatcherID, getFieldDisplayName, getFieldMatcher, reduceField, } from '@grafana/data';
import { evaluteFieldMappings, getFieldConfigFromFrame, } from '../fieldToConfigMapping/fieldToConfigMapping';
export function extractConfigFromQuery(options, data) {
    var _a;
    let configFrame = null;
    for (const frame of data) {
        if (frame.refId === options.configRefId) {
            configFrame = frame;
            break;
        }
    }
    if (!configFrame) {
        return data;
    }
    const reducedConfigFrame = {
        fields: [],
        length: 1,
    };
    const mappingResult = evaluteFieldMappings(configFrame, (_a = options.mappings) !== null && _a !== void 0 ? _a : [], false);
    // reduce config frame
    for (const field of configFrame.fields) {
        const newField = Object.assign({}, field);
        const fieldName = getFieldDisplayName(field, configFrame);
        const fieldMapping = mappingResult.index[fieldName];
        const result = reduceField({ field, reducers: [fieldMapping.reducerId] });
        newField.values = [result[fieldMapping.reducerId]];
        reducedConfigFrame.fields.push(newField);
    }
    const output = [];
    const matcher = getFieldMatcher(options.applyTo || { id: FieldMatcherID.numeric });
    for (const frame of data) {
        // Skip config frame in output
        if (frame === configFrame && data.length > 1) {
            continue;
        }
        const outputFrame = {
            fields: [],
            length: frame.length,
            refId: frame.refId,
        };
        for (const field of frame.fields) {
            if (matcher(field, frame, data)) {
                const dataConfig = getFieldConfigFromFrame(reducedConfigFrame, 0, mappingResult);
                outputFrame.fields.push(Object.assign(Object.assign({}, field), { config: Object.assign(Object.assign({}, field.config), dataConfig) }));
            }
            else {
                outputFrame.fields.push(field);
            }
        }
        output.push(outputFrame);
    }
    return output;
}
export const configFromDataTransformer = {
    id: DataTransformerID.configFromData,
    name: 'Config from query results',
    description: 'Set unit, min, max and more from data.',
    defaultOptions: {
        configRefId: 'config',
        mappings: [],
    },
    /**
     * Return a modified copy of the series. If the transform is not or should not
     * be applied, just return the input series
     */
    operator: (options) => (source) => source.pipe(map((data) => extractConfigFromQuery(options, data))),
};
//# sourceMappingURL=configFromQuery.js.map