import { countBy, chain } from 'lodash';
import { LogLevel, LogsSortOrder, FieldCache, FieldType, MutableDataFrame, LogsVolumeType, } from '@grafana/data';
import { getDataframeFields } from './components/logParser';
/**
 * Returns the log level of a log line.
 * Parse the line for level words. If no level is found, it returns `LogLevel.unknown`.
 *
 * Example: `getLogLevel('WARN 1999-12-31 this is great') // LogLevel.warn`
 */
export function getLogLevel(line) {
    if (!line) {
        return LogLevel.unknown;
    }
    let level = LogLevel.unknown;
    let currentIndex = undefined;
    for (const [key, value] of Object.entries(LogLevel)) {
        const regexp = new RegExp(`\\b${key}\\b`, 'i');
        const result = regexp.exec(line);
        if (result) {
            if (currentIndex === undefined || result.index < currentIndex) {
                level = value;
                currentIndex = result.index;
            }
        }
    }
    return level;
}
export function getLogLevelFromKey(key) {
    const level = LogLevel[key.toString().toLowerCase()];
    if (level) {
        return level;
    }
    return LogLevel.unknown;
}
export function calculateLogsLabelStats(rows, label) {
    // Consider only rows that have the given label
    const rowsWithLabel = rows.filter((row) => row.labels[label] !== undefined);
    const rowCount = rowsWithLabel.length;
    // Get label value counts for eligible rows
    const countsByValue = countBy(rowsWithLabel, (row) => row.labels[label]);
    return getSortedCounts(countsByValue, rowCount);
}
export function calculateStats(values) {
    const nonEmptyValues = values.filter((value) => value !== undefined && value !== null);
    const countsByValue = countBy(nonEmptyValues);
    return getSortedCounts(countsByValue, nonEmptyValues.length);
}
const getSortedCounts = (countsByValue, rowCount) => {
    return chain(countsByValue)
        .map((count, value) => ({ count, value, proportion: count / rowCount }))
        .sortBy('count')
        .reverse()
        .value();
};
export const sortInAscendingOrder = (a, b) => {
    // compare milliseconds
    if (a.timeEpochMs < b.timeEpochMs) {
        return -1;
    }
    if (a.timeEpochMs > b.timeEpochMs) {
        return 1;
    }
    // if milliseconds are equal, compare nanoseconds
    if (a.timeEpochNs < b.timeEpochNs) {
        return -1;
    }
    if (a.timeEpochNs > b.timeEpochNs) {
        return 1;
    }
    return 0;
};
export const sortInDescendingOrder = (a, b) => {
    // compare milliseconds
    if (a.timeEpochMs > b.timeEpochMs) {
        return -1;
    }
    if (a.timeEpochMs < b.timeEpochMs) {
        return 1;
    }
    // if milliseconds are equal, compare nanoseconds
    if (a.timeEpochNs > b.timeEpochNs) {
        return -1;
    }
    if (a.timeEpochNs < b.timeEpochNs) {
        return 1;
    }
    return 0;
};
export const sortLogsResult = (logsResult, sortOrder) => {
    const rows = logsResult ? sortLogRows(logsResult.rows, sortOrder) : [];
    return logsResult ? Object.assign(Object.assign({}, logsResult), { rows }) : { hasUniqueLabels: false, rows };
};
export const sortLogRows = (logRows, sortOrder) => sortOrder === LogsSortOrder.Ascending ? logRows.sort(sortInAscendingOrder) : logRows.sort(sortInDescendingOrder);
// Currently supports only error condition in Loki logs
export const checkLogsError = (logRow) => {
    if (logRow.labels.__error__) {
        return {
            hasError: true,
            errorMessage: logRow.labels.__error__,
        };
    }
    return {
        hasError: false,
    };
};
export const escapeUnescapedString = (string) => string.replace(/\\r\\n|\\n|\\t|\\r/g, (match) => (match.slice(1) === 't' ? '\t' : '\n'));
export function logRowsToReadableJson(logs) {
    return logs.map((log) => {
        const fields = getDataframeFields(log).reduce((acc, field) => {
            const key = field.keys[0];
            acc[key] = field.values[0];
            return acc;
        }, {});
        return {
            line: log.entry,
            timestamp: log.timeEpochNs,
            fields: Object.assign(Object.assign({}, fields), log.labels),
        };
    });
}
export const getLogsVolumeMaximumRange = (dataFrames) => {
    let widestRange = { from: Infinity, to: -Infinity };
    dataFrames.forEach((dataFrame) => {
        var _a, _b, _c;
        const meta = ((_a = dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom) || {};
        if (((_b = meta.absoluteRange) === null || _b === void 0 ? void 0 : _b.from) && ((_c = meta.absoluteRange) === null || _c === void 0 ? void 0 : _c.to)) {
            widestRange = {
                from: Math.min(widestRange.from, meta.absoluteRange.from),
                to: Math.max(widestRange.to, meta.absoluteRange.to),
            };
        }
    });
    return widestRange;
};
/**
 * Merge data frames by level and calculate maximum total value for all levels together
 */
export const mergeLogsVolumeDataFrames = (dataFrames) => {
    if (dataFrames.length === 0) {
        throw new Error('Cannot aggregate data frames: there must be at least one data frame to aggregate');
    }
    // aggregate by level (to produce data frames)
    const aggregated = {};
    // aggregate totals to align Y axis when multiple log volumes are shown
    const totals = {};
    let maximumValue = -Infinity;
    const configs = {};
    let results = [];
    // collect and aggregate into aggregated object
    dataFrames.forEach((dataFrame) => {
        var _a;
        const fieldCache = new FieldCache(dataFrame);
        const timeField = fieldCache.getFirstFieldOfType(FieldType.time);
        const valueField = fieldCache.getFirstFieldOfType(FieldType.number);
        if (!timeField) {
            throw new Error('Missing time field');
        }
        if (!valueField) {
            throw new Error('Missing value field');
        }
        const level = valueField.config.displayNameFromDS || dataFrame.name || 'logs';
        const length = valueField.values.length;
        configs[level] = {
            meta: dataFrame.meta,
            valueFieldConfig: valueField.config,
            timeFieldConfig: timeField.config,
        };
        for (let pointIndex = 0; pointIndex < length; pointIndex++) {
            const time = timeField.values[pointIndex];
            const value = valueField.values[pointIndex];
            (_a = aggregated[level]) !== null && _a !== void 0 ? _a : (aggregated[level] = {});
            aggregated[level][time] = (aggregated[level][time] || 0) + value;
            totals[time] = (totals[time] || 0) + value;
            maximumValue = Math.max(totals[time], maximumValue);
        }
    });
    // convert aggregated into data frames
    Object.keys(aggregated).forEach((level) => {
        const levelDataFrame = new MutableDataFrame();
        const { meta, timeFieldConfig, valueFieldConfig } = configs[level];
        // Log Volume visualization uses the name when toggling the legend
        levelDataFrame.name = level;
        levelDataFrame.meta = meta;
        levelDataFrame.addField({ name: 'Time', type: FieldType.time, config: timeFieldConfig });
        levelDataFrame.addField({ name: 'Value', type: FieldType.number, config: valueFieldConfig });
        for (const time in aggregated[level]) {
            const value = aggregated[level][time];
            levelDataFrame.add({
                Time: Number(time),
                Value: value,
            });
        }
        results.push(levelDataFrame);
    });
    return { dataFrames: results, maximum: maximumValue };
};
export const getLogsVolumeDataSourceInfo = (dataFrames) => {
    var _a, _b;
    const customMeta = (_b = (_a = dataFrames[0]) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.custom;
    if (customMeta && customMeta.datasourceName) {
        return {
            name: customMeta.datasourceName,
        };
    }
    return null;
};
export const isLogsVolumeLimited = (dataFrames) => {
    var _a, _b, _c;
    return ((_c = (_b = (_a = dataFrames[0]) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.custom) === null || _c === void 0 ? void 0 : _c.logsVolumeType) === LogsVolumeType.Limited;
};
//# sourceMappingURL=utils.js.map