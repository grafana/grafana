import { __values } from "tslib";
import { from, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { validateVariableSelectionState } from '../state/actions';
import { FieldType, getFieldDisplayName, isDataFrame } from '@grafana/data';
import { updateVariableOptions } from './reducer';
import { getProcessedDataFrames } from 'app/features/query/state/runRequest';
export function toMetricFindValues() {
    return function (source) {
        return source.pipe(map(function (panelData) {
            var e_1, _a, e_2, _b;
            var frames = panelData.series;
            if (!frames || !frames.length) {
                return [];
            }
            if (areMetricFindValues(frames)) {
                return frames;
            }
            var processedDataFrames = getProcessedDataFrames(frames);
            var metrics = [];
            var valueIndex = -1;
            var textIndex = -1;
            var stringIndex = -1;
            var expandableIndex = -1;
            try {
                for (var processedDataFrames_1 = __values(processedDataFrames), processedDataFrames_1_1 = processedDataFrames_1.next(); !processedDataFrames_1_1.done; processedDataFrames_1_1 = processedDataFrames_1.next()) {
                    var frame = processedDataFrames_1_1.value;
                    for (var index = 0; index < frame.fields.length; index++) {
                        var field = frame.fields[index];
                        var fieldName = getFieldDisplayName(field, frame, frames).toLowerCase();
                        if (field.type === FieldType.string && stringIndex === -1) {
                            stringIndex = index;
                        }
                        if (fieldName === 'text' && field.type === FieldType.string && textIndex === -1) {
                            textIndex = index;
                        }
                        if (fieldName === 'value' && field.type === FieldType.string && valueIndex === -1) {
                            valueIndex = index;
                        }
                        if (fieldName === 'expandable' &&
                            (field.type === FieldType.boolean || field.type === FieldType.number) &&
                            expandableIndex === -1) {
                            expandableIndex = index;
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (processedDataFrames_1_1 && !processedDataFrames_1_1.done && (_a = processedDataFrames_1.return)) _a.call(processedDataFrames_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            if (stringIndex === -1) {
                throw new Error("Couldn't find any field of type string in the results.");
            }
            try {
                for (var frames_1 = __values(frames), frames_1_1 = frames_1.next(); !frames_1_1.done; frames_1_1 = frames_1.next()) {
                    var frame = frames_1_1.value;
                    for (var index = 0; index < frame.length; index++) {
                        var expandable = expandableIndex !== -1 ? frame.fields[expandableIndex].values.get(index) : undefined;
                        var string = frame.fields[stringIndex].values.get(index);
                        var text = textIndex !== -1 ? frame.fields[textIndex].values.get(index) : null;
                        var value = valueIndex !== -1 ? frame.fields[valueIndex].values.get(index) : null;
                        if (valueIndex === -1 && textIndex === -1) {
                            metrics.push({ text: string, value: string, expandable: expandable });
                            continue;
                        }
                        if (valueIndex === -1 && textIndex !== -1) {
                            metrics.push({ text: text, value: text, expandable: expandable });
                            continue;
                        }
                        if (valueIndex !== -1 && textIndex === -1) {
                            metrics.push({ text: value, value: value, expandable: expandable });
                            continue;
                        }
                        metrics.push({ text: text, value: value, expandable: expandable });
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (frames_1_1 && !frames_1_1.done && (_b = frames_1.return)) _b.call(frames_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return metrics;
        }));
    };
}
export function updateOptionsState(args) {
    return function (source) {
        return source.pipe(map(function (results) {
            var variable = args.variable, dispatch = args.dispatch, getTemplatedRegexFunc = args.getTemplatedRegexFunc;
            var templatedRegex = getTemplatedRegexFunc(variable);
            var payload = toVariablePayload(variable, { results: results, templatedRegex: templatedRegex });
            dispatch(updateVariableOptions(payload));
        }));
    };
}
export function validateVariableSelection(args) {
    return function (source) {
        return source.pipe(mergeMap(function () {
            var dispatch = args.dispatch, variable = args.variable, searchFilter = args.searchFilter;
            // If we are searching options there is no need to validate selection state
            // This condition was added to as validateVariableSelectionState will update the current value of the variable
            // So after search and selection the current value is already update so no setValue, refresh and URL update is performed
            // The if statement below fixes https://github.com/grafana/grafana/issues/25671
            if (!searchFilter) {
                return from(dispatch(validateVariableSelectionState(toVariableIdentifier(variable))));
            }
            return of();
        }));
    };
}
export function areMetricFindValues(data) {
    if (!data) {
        return false;
    }
    if (!data.length) {
        return true;
    }
    var firstValue = data[0];
    if (isDataFrame(firstValue)) {
        return false;
    }
    for (var firstValueKey in firstValue) {
        if (!firstValue.hasOwnProperty(firstValueKey)) {
            continue;
        }
        if (firstValue[firstValueKey] !== null &&
            typeof firstValue[firstValueKey] !== 'string' &&
            typeof firstValue[firstValueKey] !== 'number') {
            continue;
        }
        var key = firstValueKey.toLowerCase();
        if (key === 'text' || key === 'value') {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=operators.js.map