import { map } from 'rxjs/operators';
import { DataTransformerID, FieldType, MutableDataFrame, isTimeSeriesFrame, ReducerID, reduceField, } from '@grafana/data';
export const timeSeriesTableTransformer = {
    id: DataTransformerID.timeSeriesTable,
    name: 'Time series to table transform',
    description: 'Time series to table rows.',
    defaultOptions: {},
    operator: (options) => (source) => source.pipe(map((data) => {
        return timeSeriesToTableTransform(options, data);
    })),
};
/**
 * Converts time series frames to table frames for use with sparkline chart type.
 *
 * @remarks
 * For each refId (queryName) convert all time series frames into a single table frame, adding each series
 * as values of a "Trend" frame field. This allows "Trend" to be rendered as area chart type.
 * Any non time series frames are returned as is.
 *
 * @param options - Transform options, currently not used
 * @param data - Array of data frames to transform
 * @returns Array of transformed data frames
 *
 * @alpha
 */
export function timeSeriesToTableTransform(options, data) {
    var _a, _b, _c, _d, _e;
    // initialize fields from labels for each refId
    const refId2LabelFields = getLabelFields(data);
    const refId2frameField = {};
    const result = [];
    for (const frame of data) {
        if (!isTimeSeriesFrame(frame)) {
            result.push(frame);
            continue;
        }
        const refId = (_a = frame.refId) !== null && _a !== void 0 ? _a : '';
        const labelFields = (_b = refId2LabelFields[refId]) !== null && _b !== void 0 ? _b : {};
        // initialize a new frame for this refId with fields per label and a Trend frame field, if it doesn't exist yet
        let frameField = refId2frameField[refId];
        if (!frameField) {
            frameField = {
                name: 'Trend' + (refId && Object.keys(refId2LabelFields).length > 1 ? ` #${refId}` : ''),
                type: FieldType.frame,
                config: {},
                values: [],
            };
            refId2frameField[refId] = frameField;
            const table = new MutableDataFrame();
            for (const label of Object.values(labelFields)) {
                table.addField(label);
            }
            table.addField(frameField);
            table.refId = refId;
            result.push(table);
        }
        // add values to each label based field of this frame
        const labels = frame.fields[1].labels;
        for (const labelKey of Object.keys(labelFields)) {
            const labelValue = (_c = labels === null || labels === void 0 ? void 0 : labels[labelKey]) !== null && _c !== void 0 ? _c : null;
            labelFields[labelKey].values.push(labelValue);
        }
        const reducerId = (_e = (_d = options.refIdToStat) === null || _d === void 0 ? void 0 : _d[refId]) !== null && _e !== void 0 ? _e : ReducerID.lastNotNull;
        const valueField = frame.fields.find((f) => f.type === FieldType.number);
        const value = (valueField && reduceField({ field: valueField, reducers: [reducerId] })[reducerId]) || null;
        frameField.values.push(Object.assign(Object.assign({}, frame), { value }));
    }
    return result;
}
// For each refId, initialize a field for each label name
function getLabelFields(frames) {
    var _a;
    // refId -> label name -> field
    const labelFields = {};
    for (const frame of frames) {
        if (!isTimeSeriesFrame(frame)) {
            continue;
        }
        const refId = (_a = frame.refId) !== null && _a !== void 0 ? _a : '';
        if (!labelFields[refId]) {
            labelFields[refId] = {};
        }
        for (const field of frame.fields) {
            if (!field.labels) {
                continue;
            }
            for (const labelName of Object.keys(field.labels)) {
                if (!labelFields[refId][labelName]) {
                    labelFields[refId][labelName] = {
                        name: labelName,
                        type: FieldType.string,
                        config: {},
                        values: [],
                    };
                }
            }
        }
    }
    return labelFields;
}
//# sourceMappingURL=timeSeriesTableTransformer.js.map