import { isString, get } from 'lodash';
import { map } from 'rxjs/operators';
import { DataTransformerID, FieldType, getFieldTypeFromValue, } from '@grafana/data';
import { findField } from 'app/features/dimensions';
import { fieldExtractors } from './fieldExtractors';
import { FieldExtractorID } from './types';
export const extractFieldsTransformer = {
    id: DataTransformerID.extractFields,
    name: 'Extract fields',
    description: 'Parse fields from the contends of another',
    defaultOptions: {},
    operator: (options, ctx) => (source) => source.pipe(map((data) => extractFieldsTransformer.transformer(options, ctx)(data))),
    transformer: (options) => {
        return (data) => {
            return data.map((v) => addExtractedFields(v, options));
        };
    },
};
function addExtractedFields(frame, options) {
    var _a, _b;
    if (!options.source) {
        return frame;
    }
    const source = findField(frame, options.source);
    if (!source) {
        // this case can happen when there are multiple queries
        return frame;
    }
    const ext = fieldExtractors.getIfExists((_a = options.format) !== null && _a !== void 0 ? _a : FieldExtractorID.Auto);
    if (!ext) {
        throw new Error('unkonwn extractor');
    }
    const count = frame.length;
    const names = []; // keep order
    const values = new Map();
    for (let i = 0; i < count; i++) {
        let obj = source.values[i];
        if (isString(obj)) {
            try {
                obj = ext.parse(obj);
            }
            catch (_c) {
                obj = {}; // empty
            }
        }
        if (obj == null) {
            continue;
        }
        if (options.format === FieldExtractorID.JSON && options.jsonPaths && ((_b = options.jsonPaths) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            const newObj = {};
            // filter out empty paths
            const filteredPaths = options.jsonPaths.filter((path) => path.path);
            if (filteredPaths.length > 0) {
                filteredPaths.forEach((path) => {
                    var _a;
                    const key = path.alias && path.alias.length > 0 ? path.alias : path.path;
                    newObj[key] = (_a = get(obj, path.path)) !== null && _a !== void 0 ? _a : 'Not Found';
                });
                obj = newObj;
            }
        }
        for (const [key, val] of Object.entries(obj)) {
            let buffer = values.get(key);
            if (buffer == null) {
                buffer = new Array(count);
                values.set(key, buffer);
                names.push(key);
            }
            buffer[i] = val;
        }
    }
    const fields = names.map((name) => {
        const buffer = values.get(name);
        return {
            name,
            values: buffer,
            type: buffer ? getFieldTypeFromValue(buffer.find((v) => v != null)) : FieldType.other,
            config: {},
        };
    });
    if (options.keepTime) {
        const sourceTime = findField(frame, 'Time') || findField(frame, 'time');
        if (sourceTime) {
            fields.unshift(sourceTime);
        }
    }
    if (!options.replace) {
        fields.unshift(...frame.fields);
    }
    return Object.assign(Object.assign({}, frame), { fields });
}
//# sourceMappingURL=extractFields.js.map