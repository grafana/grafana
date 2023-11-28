import { FieldCache, FieldType, DataFrameType } from '@grafana/data';
import { parseLegacyLogsFrame } from './legacyLogsFrame';
function getField(cache, name, fieldType) {
    const field = cache.getFieldByName(name);
    if (field === undefined) {
        return undefined;
    }
    return field.type === fieldType ? field : undefined;
}
const DATAPLANE_TIMESTAMP_NAME = 'timestamp';
const DATAPLANE_BODY_NAME = 'body';
const DATAPLANE_SEVERITY_NAME = 'severity';
const DATAPLANE_ID_NAME = 'id';
const DATAPLANE_ATTRIBUTES_NAME = 'attributes';
export function attributesToLabels(attributes) {
    const result = {};
    Object.entries(attributes).forEach(([k, v]) => {
        result[k] = typeof v === 'string' ? v : JSON.stringify(v);
    });
    return result;
}
function parseDataplaneLogsFrame(frame) {
    var _a, _b, _c;
    const cache = new FieldCache(frame);
    const timestampField = getField(cache, DATAPLANE_TIMESTAMP_NAME, FieldType.time);
    const bodyField = getField(cache, DATAPLANE_BODY_NAME, FieldType.string);
    // these two are mandatory
    if (timestampField === undefined || bodyField === undefined) {
        return null;
    }
    const severityField = (_a = getField(cache, DATAPLANE_SEVERITY_NAME, FieldType.string)) !== null && _a !== void 0 ? _a : null;
    const idField = (_b = getField(cache, DATAPLANE_ID_NAME, FieldType.string)) !== null && _b !== void 0 ? _b : null;
    const attributesField = (_c = getField(cache, DATAPLANE_ATTRIBUTES_NAME, FieldType.other)) !== null && _c !== void 0 ? _c : null;
    const attributes = attributesField === null ? null : attributesField.values;
    const extraFields = cache.fields.filter((_, i) => i !== timestampField.index &&
        i !== bodyField.index &&
        i !== (severityField === null || severityField === void 0 ? void 0 : severityField.index) &&
        i !== (idField === null || idField === void 0 ? void 0 : idField.index) &&
        i !== (attributesField === null || attributesField === void 0 ? void 0 : attributesField.index));
    return {
        timeField: timestampField,
        bodyField,
        severityField,
        idField,
        getAttributes: () => attributes,
        timeNanosecondField: null,
        getAttributesAsLabels: () => (attributes !== null ? attributes.map(attributesToLabels) : null),
        extraFields,
    };
}
export function parseLogsFrame(frame) {
    var _a;
    if (((_a = frame.meta) === null || _a === void 0 ? void 0 : _a.type) === DataFrameType.LogLines) {
        return parseDataplaneLogsFrame(frame);
    }
    else {
        return parseLegacyLogsFrame(frame);
    }
}
//# sourceMappingURL=logsFrame.js.map