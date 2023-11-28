import { groupBy } from 'lodash';
import { useMemo } from 'react';
import { FieldType, getDisplayProcessor, } from '@grafana/data';
import { fieldIndexComparer } from '@grafana/data/src/field/fieldComparers';
import { MappingType, ThresholdsMode } from '@grafana/schema';
import { useTheme2 } from '@grafana/ui';
import { labelsMatchMatchers, parseMatchers } from '../../../utils/alertmanager';
import { extractCommonLabels, omitLabels } from './common';
export function useRuleHistoryRecords(stateHistory, filter) {
    const theme = useTheme2();
    return useMemo(() => {
        var _a, _b, _c, _d;
        // merge timestamp with "line"
        const tsValues = (_b = (_a = stateHistory === null || stateHistory === void 0 ? void 0 : stateHistory.data) === null || _a === void 0 ? void 0 : _a.values[0]) !== null && _b !== void 0 ? _b : [];
        const timestamps = isNumbers(tsValues) ? tsValues : [];
        const lines = (_d = (_c = stateHistory === null || stateHistory === void 0 ? void 0 : stateHistory.data) === null || _c === void 0 ? void 0 : _c.values[1]) !== null && _d !== void 0 ? _d : [];
        const logRecords = timestamps.reduce((acc, timestamp, index) => {
            const line = lines[index];
            // values property can be undefined for some instance states (e.g. NoData)
            if (isLine(line)) {
                acc.push({ timestamp, line });
            }
            return acc;
        }, []);
        // group all records by alert instance (unique set of labels)
        const logRecordsByInstance = groupBy(logRecords, (record) => {
            return JSON.stringify(record.line.labels);
        });
        // CommonLabels should not be affected by the filter
        // find common labels so we can extract those from the instances
        const groupLabels = Object.keys(logRecordsByInstance);
        const groupLabelsArray = groupLabels.map((label) => {
            return Object.entries(JSON.parse(label));
        });
        const commonLabels = extractCommonLabels(groupLabelsArray);
        const filterMatchers = filter ? parseMatchers(filter) : [];
        const filteredGroupedLines = Object.entries(logRecordsByInstance).filter(([key]) => {
            const labels = JSON.parse(key);
            return labelsMatchMatchers(labels, filterMatchers);
        });
        const dataFrames = filteredGroupedLines.map(([key, records]) => {
            return logRecordsToDataFrame(key, records, commonLabels, theme);
        });
        return {
            historyRecords: logRecords.filter(({ line }) => line.labels && labelsMatchMatchers(line.labels, filterMatchers)),
            dataFrames,
            commonLabels,
            totalRecordsCount: logRecords.length,
        };
    }, [stateHistory, filter, theme]);
}
export function isNumbers(value) {
    return value.every((v) => typeof v === 'number');
}
export function isLine(value) {
    return typeof value === 'object' && value !== null && 'current' in value && 'previous' in value;
}
// Each alert instance is represented by a data frame
// Each frame consists of two fields: timestamp and state change
export function logRecordsToDataFrame(instanceLabels, records, commonLabels, theme) {
    var _a;
    const parsedInstanceLabels = Object.entries(JSON.parse(instanceLabels));
    // There is an artificial element at the end meaning Date.now()
    // It exist to draw the state change from when it happened to the current time
    const timeField = {
        name: 'time',
        type: FieldType.time,
        values: [...records.map((record) => record.timestamp), Date.now()],
        config: { displayName: 'Time', custom: { fillOpacity: 100 } },
    };
    const timeIndex = timeField.values.map((_, index) => index);
    timeIndex.sort(fieldIndexComparer(timeField));
    const stateValues = [...records.map((record) => record.line.current), (_a = records.at(-1)) === null || _a === void 0 ? void 0 : _a.line.current];
    const frame = {
        fields: [
            Object.assign(Object.assign({}, timeField), { values: timeField.values.map((_, i) => timeField.values[timeIndex[i]]) }),
            {
                name: 'state',
                type: FieldType.string,
                values: stateValues.map((_, i) => stateValues[timeIndex[i]]),
                config: {
                    displayName: omitLabels(parsedInstanceLabels, commonLabels)
                        .map(([key, label]) => `${key}=${label}`)
                        .join(', '),
                    color: { mode: 'thresholds' },
                    custom: { fillOpacity: 100 },
                    mappings: [
                        {
                            type: MappingType.ValueToText,
                            options: {
                                Alerting: {
                                    color: theme.colors.error.main,
                                },
                                Pending: {
                                    color: theme.colors.warning.main,
                                },
                                Normal: {
                                    color: theme.colors.success.main,
                                },
                                NoData: {
                                    color: theme.colors.info.main,
                                },
                            },
                        },
                    ],
                    thresholds: {
                        mode: ThresholdsMode.Absolute,
                        steps: [],
                    },
                },
            },
        ],
        length: timeField.values.length,
        name: instanceLabels,
    };
    frame.fields.forEach((field) => {
        field.display = getDisplayProcessor({ field, theme });
    });
    return frame;
}
//# sourceMappingURL=useRuleHistoryRecords.js.map