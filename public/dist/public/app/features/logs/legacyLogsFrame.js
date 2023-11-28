import { FieldCache, FieldType } from '@grafana/data';
// take the labels from the line-field, and "stretch" it into an array
// with the length of the frame (so there are the same labels for every row)
function makeLabelsArray(lineField, length) {
    const lineLabels = lineField.labels;
    if (lineLabels !== undefined) {
        const result = new Array(length);
        result.fill(lineLabels);
        return result;
    }
    else {
        return null;
    }
}
// we decide if the frame is old-loki-style frame, and adjust the behavior.
// we also have to return the labels-field (if we used it),
// to be able to remove it from the unused-fields, later.
function makeLabelsGetter(cache, lineField, frame) {
    var _a, _b;
    if (((_b = (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.frameType) === 'LabeledTimeValues') {
        const labelsField = cache.getFieldByName('labels');
        return labelsField === undefined ? [null, () => null] : [labelsField, () => labelsField.values];
    }
    else {
        // we use the labels on the line-field, and make an array with it
        return [null, () => makeLabelsArray(lineField, frame.length)];
    }
}
export function parseLegacyLogsFrame(frame) {
    var _a, _b, _c;
    const cache = new FieldCache(frame);
    const timeField = cache.getFirstFieldOfType(FieldType.time);
    const bodyField = cache.getFirstFieldOfType(FieldType.string);
    // these two are mandatory
    if (timeField === undefined || bodyField === undefined) {
        return null;
    }
    const timeNanosecondField = (_a = cache.getFieldByName('tsNs')) !== null && _a !== void 0 ? _a : null;
    const severityField = (_b = cache.getFieldByName('level')) !== null && _b !== void 0 ? _b : null;
    const idField = (_c = cache.getFieldByName('id')) !== null && _c !== void 0 ? _c : null;
    // extracting the labels is done very differently for old-loki-style and simple-style
    // dataframes, so it's a little awkward to handle it,
    // we both need to on-demand extract the labels, and also get teh labelsField,
    // but only if the labelsField is used.
    const [labelsField, getL] = makeLabelsGetter(cache, bodyField, frame);
    const extraFields = cache.fields.filter((_, i) => i !== timeField.index &&
        i !== bodyField.index &&
        i !== (timeNanosecondField === null || timeNanosecondField === void 0 ? void 0 : timeNanosecondField.index) &&
        i !== (severityField === null || severityField === void 0 ? void 0 : severityField.index) &&
        i !== (idField === null || idField === void 0 ? void 0 : idField.index) &&
        i !== (labelsField === null || labelsField === void 0 ? void 0 : labelsField.index));
    return {
        timeField,
        bodyField,
        timeNanosecondField,
        severityField,
        idField,
        getAttributes: getL,
        getAttributesAsLabels: getL,
        extraFields,
    };
}
//# sourceMappingURL=legacyLogsFrame.js.map