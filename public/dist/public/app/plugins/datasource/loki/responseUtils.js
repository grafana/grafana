import { DataFrameType, FieldType, isValidGoDuration, shallowCompare, } from '@grafana/data';
import { isBytesString } from './languageUtils';
import { isLogLineJSON, isLogLineLogfmt, isLogLinePacked } from './lineParser';
export function dataFrameHasLokiError(frame) {
    var _a, _b;
    const labelSets = (_b = (_a = frame.fields.find((f) => f.name === 'labels')) === null || _a === void 0 ? void 0 : _a.values) !== null && _b !== void 0 ? _b : [];
    return labelSets.some((labels) => labels.__error__ !== undefined);
}
export function dataFrameHasLevelLabel(frame) {
    var _a, _b;
    const labelSets = (_b = (_a = frame.fields.find((f) => f.name === 'labels')) === null || _a === void 0 ? void 0 : _a.values) !== null && _b !== void 0 ? _b : [];
    return labelSets.some((labels) => labels.level !== undefined);
}
export function extractLogParserFromDataFrame(frame) {
    const lineField = frame.fields.find((field) => field.type === FieldType.string);
    if (lineField == null) {
        return { hasJSON: false, hasLogfmt: false, hasPack: false };
    }
    const logLines = lineField.values;
    let hasJSON = false;
    let hasLogfmt = false;
    let hasPack = false;
    logLines.forEach((line) => {
        if (isLogLineJSON(line)) {
            hasJSON = true;
            hasPack = isLogLinePacked(line);
        }
        if (isLogLineLogfmt(line)) {
            hasLogfmt = true;
        }
    });
    return { hasLogfmt, hasJSON, hasPack };
}
export function extractLabelKeysFromDataFrame(frame) {
    var _a, _b, _c;
    const labelsArray = (_c = (_b = (_a = frame === null || frame === void 0 ? void 0 : frame.fields) === null || _a === void 0 ? void 0 : _a.find((field) => field.name === 'labels')) === null || _b === void 0 ? void 0 : _b.values) !== null && _c !== void 0 ? _c : [];
    if (!(labelsArray === null || labelsArray === void 0 ? void 0 : labelsArray.length)) {
        return [];
    }
    return Object.keys(labelsArray[0]);
}
export function extractUnwrapLabelKeysFromDataFrame(frame) {
    var _a, _b, _c;
    const labelsArray = (_c = (_b = (_a = frame === null || frame === void 0 ? void 0 : frame.fields) === null || _a === void 0 ? void 0 : _a.find((field) => field.name === 'labels')) === null || _b === void 0 ? void 0 : _b.values) !== null && _c !== void 0 ? _c : [];
    if (!(labelsArray === null || labelsArray === void 0 ? void 0 : labelsArray.length)) {
        return [];
    }
    // We do this only for first label object, because we want to consider only labels that are present in all log lines
    // possibleUnwrapLabels are labels with 1. number value OR 2. value that is valid go duration OR 3. bytes string value
    const possibleUnwrapLabels = Object.keys(labelsArray[0]).filter((key) => {
        const value = labelsArray[0][key];
        if (!value) {
            return false;
        }
        return !isNaN(Number(value)) || isValidGoDuration(value) || isBytesString(value);
    });
    // Add only labels that are present in every line to unwrapLabels
    return possibleUnwrapLabels.filter((label) => labelsArray.every((obj) => obj[label]));
}
export function extractHasErrorLabelFromDataFrame(frame) {
    const labelField = frame.fields.find((field) => field.name === 'labels' && field.type === FieldType.other);
    if (labelField == null) {
        return false;
    }
    const labels = labelField.values;
    return labels.some((label) => label['__error__']);
}
export function extractLevelLikeLabelFromDataFrame(frame) {
    const labelField = frame.fields.find((field) => field.name === 'labels' && field.type === FieldType.other);
    if (labelField == null) {
        return null;
    }
    // Depending on number of labels, this can be pretty heavy operation.
    // Let's just look at first 2 lines If needed, we can introduce more later.
    const labelsArray = labelField.values.slice(0, 2);
    let levelLikeLabel = null;
    // Find first level-like label
    for (let labels of labelsArray) {
        const label = Object.keys(labels).find((label) => label === 'lvl' || label.includes('level'));
        if (label) {
            levelLikeLabel = label;
            break;
        }
    }
    return levelLikeLabel;
}
function shouldCombine(frame1, frame2) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (frame1.refId !== frame2.refId) {
        return false;
    }
    const frameType1 = (_a = frame1.meta) === null || _a === void 0 ? void 0 : _a.type;
    const frameType2 = (_b = frame2.meta) === null || _b === void 0 ? void 0 : _b.type;
    if (frameType1 !== frameType2) {
        // we do not join things that have a different type
        return false;
    }
    // metric range query data
    if (frameType1 === DataFrameType.TimeSeriesMulti) {
        const field1 = frame1.fields.find((f) => f.type === FieldType.number);
        const field2 = frame2.fields.find((f) => f.type === FieldType.number);
        if (field1 === undefined || field2 === undefined) {
            // should never happen
            return false;
        }
        return shallowCompare((_c = field1.labels) !== null && _c !== void 0 ? _c : {}, (_d = field2.labels) !== null && _d !== void 0 ? _d : {});
    }
    // logs query data
    // logs use a special attribute in the dataframe's "custom" section
    // because we do not have a good "frametype" value for them yet.
    const customType1 = (_f = (_e = frame1.meta) === null || _e === void 0 ? void 0 : _e.custom) === null || _f === void 0 ? void 0 : _f.frameType;
    const customType2 = (_h = (_g = frame2.meta) === null || _g === void 0 ? void 0 : _g.custom) === null || _h === void 0 ? void 0 : _h.frameType;
    if (customType1 === 'LabeledTimeValues' && customType2 === 'LabeledTimeValues') {
        return true;
    }
    // should never reach here
    return false;
}
export function combineResponses(currentResult, newResult) {
    var _a, _b, _c, _d, _e;
    if (!currentResult) {
        return cloneQueryResponse(newResult);
    }
    newResult.data.forEach((newFrame) => {
        const currentFrame = currentResult.data.find((frame) => shouldCombine(frame, newFrame));
        if (!currentFrame) {
            currentResult.data.push(cloneDataFrame(newFrame));
            return;
        }
        combineFrames(currentFrame, newFrame);
    });
    const mergedErrors = [...((_a = currentResult.errors) !== null && _a !== void 0 ? _a : []), ...((_b = newResult.errors) !== null && _b !== void 0 ? _b : [])];
    // we make sure to have `.errors` as undefined, instead of empty-array
    // when no errors.
    if (mergedErrors.length > 0) {
        currentResult.errors = mergedErrors;
    }
    // the `.error` attribute is obsolete now,
    // but we have to maintain it, otherwise
    // some grafana parts do not behave well.
    // we just choose the old error, if it exists,
    // otherwise the new error, if it exists.
    const mergedError = (_c = currentResult.error) !== null && _c !== void 0 ? _c : newResult.error;
    if (mergedError != null) {
        currentResult.error = mergedError;
    }
    const mergedTraceIds = [...((_d = currentResult.traceIds) !== null && _d !== void 0 ? _d : []), ...((_e = newResult.traceIds) !== null && _e !== void 0 ? _e : [])];
    if (mergedTraceIds.length > 0) {
        currentResult.traceIds = mergedTraceIds;
    }
    return currentResult;
}
function combineFrames(dest, source) {
    var _a, _b, _c, _d, _e, _f;
    const totalFields = dest.fields.length;
    for (let i = 0; i < totalFields; i++) {
        dest.fields[i].values = [].concat.apply(source.fields[i].values, dest.fields[i].values);
        if (source.fields[i].nanos) {
            const nanos = ((_a = dest.fields[i].nanos) === null || _a === void 0 ? void 0 : _a.slice()) || [];
            dest.fields[i].nanos = (_b = source.fields[i].nanos) === null || _b === void 0 ? void 0 : _b.concat(nanos);
        }
    }
    dest.length += source.length;
    dest.meta = Object.assign(Object.assign({}, dest.meta), { stats: getCombinedMetadataStats((_d = (_c = dest.meta) === null || _c === void 0 ? void 0 : _c.stats) !== null && _d !== void 0 ? _d : [], (_f = (_e = source.meta) === null || _e === void 0 ? void 0 : _e.stats) !== null && _f !== void 0 ? _f : []) });
}
const TOTAL_BYTES_STAT = 'Summary: total bytes processed';
function getCombinedMetadataStats(destStats, sourceStats) {
    // in the current approach, we only handle a single stat
    const destStat = destStats.find((s) => s.displayName === TOTAL_BYTES_STAT);
    const sourceStat = sourceStats.find((s) => s.displayName === TOTAL_BYTES_STAT);
    if (sourceStat != null && destStat != null) {
        return [{ value: sourceStat.value + destStat.value, displayName: TOTAL_BYTES_STAT, unit: destStat.unit }];
    }
    // maybe one of them exist
    const eitherStat = sourceStat !== null && sourceStat !== void 0 ? sourceStat : destStat;
    if (eitherStat != null) {
        return [eitherStat];
    }
    return [];
}
/**
 * Deep clones a DataQueryResponse
 */
export function cloneQueryResponse(response) {
    const newResponse = Object.assign(Object.assign({}, response), { data: response.data.map(cloneDataFrame) });
    return newResponse;
}
function cloneDataFrame(frame) {
    return Object.assign(Object.assign({}, frame), { fields: frame.fields.map((field) => (Object.assign(Object.assign({}, field), { values: field.values }))) });
}
//# sourceMappingURL=responseUtils.js.map