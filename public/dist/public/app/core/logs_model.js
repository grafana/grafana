var _a;
import { __assign, __read, __spreadArray, __values } from "tslib";
import { size } from 'lodash';
import { BarAlignment, GraphDrawStyle, StackingMode } from '@grafana/schema';
import { ansicolor, colors } from '@grafana/ui';
import { dateTime, dateTimeFormat, dateTimeFormatTimeAgo, FieldCache, FieldColorModeId, FieldType, findCommonLabels, findUniqueLabels, getLogLevel, getLogLevelFromKey, LogLevel, LogsDedupStrategy, LogsMetaKind, rangeUtil, sortInAscendingOrder, textUtil, toDataFrame, } from '@grafana/data';
import { getThemeColor } from 'app/core/utils/colors';
import { SIPrefix } from '@grafana/data/src/valueFormats/symbolFormatters';
export var LIMIT_LABEL = 'Line limit';
export var COMMON_LABELS = 'Common labels';
export var LogLevelColor = (_a = {},
    _a[LogLevel.critical] = colors[7],
    _a[LogLevel.warning] = colors[1],
    _a[LogLevel.error] = colors[4],
    _a[LogLevel.info] = colors[0],
    _a[LogLevel.debug] = colors[5],
    _a[LogLevel.trace] = colors[2],
    _a[LogLevel.unknown] = getThemeColor('#8e8e8e', '#dde4ed'),
    _a);
var isoDateRegexp = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-6]\d[,\.]\d+([+-][0-2]\d:[0-5]\d|Z)/g;
function isDuplicateRow(row, other, strategy) {
    switch (strategy) {
        case LogsDedupStrategy.exact:
            // Exact still strips dates
            return row.entry.replace(isoDateRegexp, '') === other.entry.replace(isoDateRegexp, '');
        case LogsDedupStrategy.numbers:
            return row.entry.replace(/\d/g, '') === other.entry.replace(/\d/g, '');
        case LogsDedupStrategy.signature:
            return row.entry.replace(/\w/g, '') === other.entry.replace(/\w/g, '');
        default:
            return false;
    }
}
export function dedupLogRows(rows, strategy) {
    if (strategy === LogsDedupStrategy.none) {
        return rows;
    }
    return rows.reduce(function (result, row, index) {
        var rowCopy = __assign({}, row);
        var previous = result[result.length - 1];
        if (index > 0 && isDuplicateRow(row, previous, strategy)) {
            previous.duplicates++;
        }
        else {
            rowCopy.duplicates = 0;
            result.push(rowCopy);
        }
        return result;
    }, []);
}
export function filterLogLevels(logRows, hiddenLogLevels) {
    if (hiddenLogLevels.size === 0) {
        return logRows;
    }
    return logRows.filter(function (row) {
        return !hiddenLogLevels.has(row.logLevel);
    });
}
export function makeDataFramesForLogs(sortedRows, bucketSize) {
    // currently interval is rangeMs / resolution, which is too low for showing series as bars.
    // Should be solved higher up the chain when executing queries & interval calculated and not here but this is a temporary fix.
    var e_1, _a, e_2, _b;
    // Graph time series by log level
    var seriesByLevel = {};
    var seriesList = [];
    try {
        for (var sortedRows_1 = __values(sortedRows), sortedRows_1_1 = sortedRows_1.next(); !sortedRows_1_1.done; sortedRows_1_1 = sortedRows_1.next()) {
            var row = sortedRows_1_1.value;
            var series = seriesByLevel[row.logLevel];
            if (!series) {
                seriesByLevel[row.logLevel] = series = {
                    lastTs: null,
                    datapoints: [],
                    target: row.logLevel,
                    color: LogLevelColor[row.logLevel],
                };
                seriesList.push(series);
            }
            // align time to bucket size - used Math.floor for calculation as time of the bucket
            // must be in the past (before Date.now()) to be displayed on the graph
            var time = Math.floor(row.timeEpochMs / bucketSize) * bucketSize;
            // Entry for time
            if (time === series.lastTs) {
                series.datapoints[series.datapoints.length - 1][0]++;
            }
            else {
                series.datapoints.push([1, time]);
                series.lastTs = time;
            }
            try {
                // add zero to other levels to aid stacking so each level series has same number of points
                for (var seriesList_1 = (e_2 = void 0, __values(seriesList)), seriesList_1_1 = seriesList_1.next(); !seriesList_1_1.done; seriesList_1_1 = seriesList_1.next()) {
                    var other = seriesList_1_1.value;
                    if (other !== series && other.lastTs !== time) {
                        other.datapoints.push([0, time]);
                        other.lastTs = time;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (seriesList_1_1 && !seriesList_1_1.done && (_b = seriesList_1.return)) _b.call(seriesList_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (sortedRows_1_1 && !sortedRows_1_1.done && (_a = sortedRows_1.return)) _a.call(sortedRows_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return seriesList.map(function (series, i) {
        series.datapoints.sort(function (a, b) { return a[1] - b[1]; });
        var data = toDataFrame(series);
        var fieldCache = new FieldCache(data);
        var valueField = fieldCache.getFirstFieldOfType(FieldType.number);
        data.fields[valueField.index].config.min = 0;
        data.fields[valueField.index].config.decimals = 0;
        data.fields[valueField.index].config.color = {
            mode: FieldColorModeId.Fixed,
            fixedColor: series.color,
        };
        data.fields[valueField.index].config.custom = {
            drawStyle: GraphDrawStyle.Bars,
            barAlignment: BarAlignment.Center,
            barWidthFactor: 0.9,
            barMaxWidth: 5,
            lineColor: series.color,
            pointColor: series.color,
            fillColor: series.color,
            lineWidth: 0,
            fillOpacity: 100,
            stacking: {
                mode: StackingMode.Normal,
                group: 'A',
            },
        };
        return data;
    });
}
function isLogsData(series) {
    return series.fields.some(function (f) { return f.type === FieldType.time; }) && series.fields.some(function (f) { return f.type === FieldType.string; });
}
/**
 * Convert dataFrame into LogsModel which consists of creating separate array of log rows and metrics series. Metrics
 * series can be either already included in the dataFrame or will be computed from the log rows.
 * @param dataFrame
 * @param intervalMs In case there are no metrics series, we use this for computing it from log rows.
 */
export function dataFrameToLogsModel(dataFrame, intervalMs, absoluteRange, queries) {
    var logSeries = separateLogsAndMetrics(dataFrame).logSeries;
    var logsModel = logSeriesToLogsModel(logSeries);
    if (logsModel) {
        // Create histogram metrics from logs using the interval as bucket size for the line count
        if (intervalMs && logsModel.rows.length > 0) {
            var sortedRows = logsModel.rows.sort(sortInAscendingOrder);
            var _a = getSeriesProperties(sortedRows, intervalMs, absoluteRange), visibleRange = _a.visibleRange, bucketSize = _a.bucketSize, visibleRangeMs = _a.visibleRangeMs, requestedRangeMs = _a.requestedRangeMs;
            logsModel.visibleRange = visibleRange;
            logsModel.series = makeDataFramesForLogs(sortedRows, bucketSize);
            if (logsModel.meta) {
                logsModel.meta = adjustMetaInfo(logsModel, visibleRangeMs, requestedRangeMs);
            }
        }
        else {
            logsModel.series = [];
        }
        logsModel.queries = queries;
        return logsModel;
    }
    return {
        hasUniqueLabels: false,
        rows: [],
        meta: [],
        series: [],
        queries: queries,
    };
}
/**
 * Returns a clamped time range and interval based on the visible logs and the given range.
 *
 * @param sortedRows Log rows from the query response
 * @param intervalMs Dynamic data interval based on available pixel width
 * @param absoluteRange Requested time range
 * @param pxPerBar Default: 20, buckets will be rendered as bars, assuming 10px per histogram bar plus some free space around it
 */
export function getSeriesProperties(sortedRows, intervalMs, absoluteRange, pxPerBar, minimumBucketSize) {
    if (pxPerBar === void 0) { pxPerBar = 20; }
    if (minimumBucketSize === void 0) { minimumBucketSize = 1000; }
    var visibleRange = absoluteRange;
    var resolutionIntervalMs = intervalMs;
    var bucketSize = Math.max(resolutionIntervalMs * pxPerBar, minimumBucketSize);
    var visibleRangeMs;
    var requestedRangeMs;
    // Clamp time range to visible logs otherwise big parts of the graph might look empty
    if (absoluteRange) {
        var earliestTsLogs = sortedRows[0].timeEpochMs;
        requestedRangeMs = absoluteRange.to - absoluteRange.from;
        visibleRangeMs = absoluteRange.to - earliestTsLogs;
        if (visibleRangeMs > 0) {
            // Adjust interval bucket size for potentially shorter visible range
            var clampingFactor = visibleRangeMs / requestedRangeMs;
            resolutionIntervalMs *= clampingFactor;
            // Minimum bucketsize of 1s for nicer graphing
            bucketSize = Math.max(Math.ceil(resolutionIntervalMs * pxPerBar), minimumBucketSize);
            // makeSeriesForLogs() aligns dataspoints with time buckets, so we do the same here to not cut off data
            var adjustedEarliest = Math.floor(earliestTsLogs / bucketSize) * bucketSize;
            visibleRange = { from: adjustedEarliest, to: absoluteRange.to };
        }
        else {
            // We use visibleRangeMs to calculate range coverage of received logs. However, some data sources are rounding up range in requests. This means that received logs
            // can (in edge cases) be outside of the requested range and visibleRangeMs < 0. In that case, we want to change visibleRangeMs to be 1 so we can calculate coverage.
            visibleRangeMs = 1;
        }
    }
    return { bucketSize: bucketSize, visibleRange: visibleRange, visibleRangeMs: visibleRangeMs, requestedRangeMs: requestedRangeMs };
}
function separateLogsAndMetrics(dataFrames) {
    var e_3, _a;
    var metricSeries = [];
    var logSeries = [];
    try {
        for (var dataFrames_1 = __values(dataFrames), dataFrames_1_1 = dataFrames_1.next(); !dataFrames_1_1.done; dataFrames_1_1 = dataFrames_1.next()) {
            var dataFrame = dataFrames_1_1.value;
            // We want to show meta stats even if no result was returned. That's why we are pushing also data frames with no fields.
            if (isLogsData(dataFrame) || !dataFrame.fields.length) {
                logSeries.push(dataFrame);
                continue;
            }
            if (dataFrame.length > 0) {
                metricSeries.push(dataFrame);
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (dataFrames_1_1 && !dataFrames_1_1.done && (_a = dataFrames_1.return)) _a.call(dataFrames_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return { logSeries: logSeries, metricSeries: metricSeries };
}
/**
 * Converts dataFrames into LogsModel. This involves merging them into one list, sorting them and computing metadata
 * like common labels.
 */
export function logSeriesToLogsModel(logSeries) {
    var e_4, _a, e_5, _b;
    var _c, _d, _e, _f, _g, _h, _j;
    if (logSeries.length === 0) {
        return undefined;
    }
    var allLabels = [];
    // Find the fields we care about and collect all labels
    var allSeries = [];
    // We are sometimes passing data frames with no fields because we want to calculate correct meta stats.
    // Therefore we need to filter out series with no fields. These series are used only for meta stats calculation.
    var seriesWithFields = logSeries.filter(function (series) { return series.fields.length; });
    if (seriesWithFields.length) {
        allSeries = seriesWithFields.map(function (series) {
            var fieldCache = new FieldCache(series);
            var stringField = fieldCache.getFirstFieldOfType(FieldType.string);
            if (stringField === null || stringField === void 0 ? void 0 : stringField.labels) {
                allLabels.push(stringField.labels);
            }
            return {
                series: series,
                timeField: fieldCache.getFirstFieldOfType(FieldType.time),
                timeNanosecondField: fieldCache.hasFieldWithNameAndType('tsNs', FieldType.time)
                    ? fieldCache.getFieldByName('tsNs')
                    : undefined,
                stringField: stringField,
                logLevelField: fieldCache.getFieldByName('level'),
                idField: getIdField(fieldCache),
            };
        });
    }
    var commonLabels = allLabels.length > 0 ? findCommonLabels(allLabels) : {};
    var rows = [];
    var hasUniqueLabels = false;
    try {
        for (var allSeries_1 = __values(allSeries), allSeries_1_1 = allSeries_1.next(); !allSeries_1_1.done; allSeries_1_1 = allSeries_1.next()) {
            var info = allSeries_1_1.value;
            var timeField = info.timeField, timeNanosecondField = info.timeNanosecondField, stringField = info.stringField, logLevelField = info.logLevelField, idField = info.idField, series = info.series;
            var labels = stringField.labels;
            var uniqueLabels = findUniqueLabels(labels, commonLabels);
            if (Object.keys(uniqueLabels).length > 0) {
                hasUniqueLabels = true;
            }
            var seriesLogLevel = undefined;
            if (labels && Object.keys(labels).indexOf('level') !== -1) {
                seriesLogLevel = getLogLevelFromKey(labels['level']);
            }
            for (var j = 0; j < series.length; j++) {
                var ts = timeField.values.get(j);
                var time = dateTime(ts);
                var tsNs = timeNanosecondField ? timeNanosecondField.values.get(j) : undefined;
                var timeEpochNs = tsNs ? tsNs : time.valueOf() + '000000';
                // In edge cases, this can be undefined. If undefined, we want to replace it with empty string.
                var messageValue = (_c = stringField.values.get(j)) !== null && _c !== void 0 ? _c : '';
                // This should be string but sometimes isn't (eg elastic) because the dataFrame is not strongly typed.
                var message = typeof messageValue === 'string' ? messageValue : JSON.stringify(messageValue);
                var hasAnsi = textUtil.hasAnsiCodes(message);
                var hasUnescapedContent = !!message.match(/\\n|\\t|\\r/);
                var searchWords = series.meta && series.meta.searchWords ? series.meta.searchWords : [];
                var entry = hasAnsi ? ansicolor.strip(message) : message;
                var logLevel = LogLevel.unknown;
                if (logLevelField && logLevelField.values.get(j)) {
                    logLevel = getLogLevelFromKey(logLevelField.values.get(j));
                }
                else if (seriesLogLevel) {
                    logLevel = seriesLogLevel;
                }
                else {
                    logLevel = getLogLevel(entry);
                }
                rows.push({
                    entryFieldIndex: stringField.index,
                    rowIndex: j,
                    dataFrame: series,
                    logLevel: logLevel,
                    timeFromNow: dateTimeFormatTimeAgo(ts),
                    timeEpochMs: time.valueOf(),
                    timeEpochNs: timeEpochNs,
                    timeLocal: dateTimeFormat(ts, { timeZone: 'browser' }),
                    timeUtc: dateTimeFormat(ts, { timeZone: 'utc' }),
                    uniqueLabels: uniqueLabels,
                    hasAnsi: hasAnsi,
                    hasUnescapedContent: hasUnescapedContent,
                    searchWords: searchWords,
                    entry: entry,
                    raw: message,
                    labels: stringField.labels || {},
                    uid: idField ? idField.values.get(j) : j.toString(),
                });
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (allSeries_1_1 && !allSeries_1_1.done && (_a = allSeries_1.return)) _a.call(allSeries_1);
        }
        finally { if (e_4) throw e_4.error; }
    }
    // Meta data to display in status
    var meta = [];
    if (size(commonLabels) > 0) {
        meta.push({
            label: COMMON_LABELS,
            value: commonLabels,
            kind: LogsMetaKind.LabelsMap,
        });
    }
    var limits = logSeries.filter(function (series) { return series.meta && series.meta.limit; });
    var limitValue = Object.values(limits.reduce(function (acc, elem) {
        acc[elem.refId] = elem.meta.limit;
        return acc;
    }, {})).reduce(function (acc, elem) { return (acc += elem); }, 0);
    if (limitValue > 0) {
        meta.push({
            label: LIMIT_LABEL,
            value: limitValue,
            kind: LogsMetaKind.Number,
        });
    }
    var totalBytes = 0;
    var queriesVisited = {};
    // To add just 1 error message
    var errorMetaAdded = false;
    var _loop_1 = function (series) {
        var totalBytesKey = (_e = (_d = series.meta) === null || _d === void 0 ? void 0 : _d.custom) === null || _e === void 0 ? void 0 : _e.lokiQueryStatKey;
        var refId = series.refId; // Stats are per query, keeping track by refId
        if (!errorMetaAdded && ((_g = (_f = series.meta) === null || _f === void 0 ? void 0 : _f.custom) === null || _g === void 0 ? void 0 : _g.error)) {
            meta.push({
                label: '',
                value: (_h = series.meta) === null || _h === void 0 ? void 0 : _h.custom.error,
                kind: LogsMetaKind.Error,
            });
            errorMetaAdded = true;
        }
        if (refId && !queriesVisited[refId]) {
            if (totalBytesKey && ((_j = series.meta) === null || _j === void 0 ? void 0 : _j.stats)) {
                var byteStat = series.meta.stats.find(function (stat) { return stat.displayName === totalBytesKey; });
                if (byteStat) {
                    totalBytes += byteStat.value;
                }
            }
            queriesVisited[refId] = true;
        }
    };
    try {
        for (var logSeries_1 = __values(logSeries), logSeries_1_1 = logSeries_1.next(); !logSeries_1_1.done; logSeries_1_1 = logSeries_1.next()) {
            var series = logSeries_1_1.value;
            _loop_1(series);
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (logSeries_1_1 && !logSeries_1_1.done && (_b = logSeries_1.return)) _b.call(logSeries_1);
        }
        finally { if (e_5) throw e_5.error; }
    }
    if (totalBytes > 0) {
        var _k = SIPrefix('B')(totalBytes), text = _k.text, suffix = _k.suffix;
        meta.push({
            label: 'Total bytes processed',
            value: text + " " + suffix,
            kind: LogsMetaKind.String,
        });
    }
    return {
        hasUniqueLabels: hasUniqueLabels,
        meta: meta,
        rows: rows,
    };
}
function getIdField(fieldCache) {
    var e_6, _a;
    var idFieldNames = ['id'];
    try {
        for (var idFieldNames_1 = __values(idFieldNames), idFieldNames_1_1 = idFieldNames_1.next(); !idFieldNames_1_1.done; idFieldNames_1_1 = idFieldNames_1.next()) {
            var fieldName = idFieldNames_1_1.value;
            var idField = fieldCache.getFieldByName(fieldName);
            if (idField) {
                return idField;
            }
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (idFieldNames_1_1 && !idFieldNames_1_1.done && (_a = idFieldNames_1.return)) _a.call(idFieldNames_1);
        }
        finally { if (e_6) throw e_6.error; }
    }
    return undefined;
}
// Used to add additional information to Line limit meta info
function adjustMetaInfo(logsModel, visibleRangeMs, requestedRangeMs) {
    var _a;
    var logsModelMeta = __spreadArray([], __read(logsModel.meta), false);
    var limitIndex = logsModelMeta.findIndex(function (meta) { return meta.label === LIMIT_LABEL; });
    var limit = limitIndex >= 0 && ((_a = logsModelMeta[limitIndex]) === null || _a === void 0 ? void 0 : _a.value);
    if (limit && limit > 0) {
        var metaLimitValue = void 0;
        if (limit === logsModel.rows.length && visibleRangeMs && requestedRangeMs) {
            var coverage = ((visibleRangeMs / requestedRangeMs) * 100).toFixed(2);
            metaLimitValue = limit + " reached, received logs cover " + coverage + "% (" + rangeUtil.msRangeToTimeString(visibleRangeMs) + ") of your selected time range (" + rangeUtil.msRangeToTimeString(requestedRangeMs) + ")";
        }
        else {
            metaLimitValue = limit + " (" + logsModel.rows.length + " returned)";
        }
        logsModelMeta[limitIndex] = {
            label: LIMIT_LABEL,
            value: metaLimitValue,
            kind: LogsMetaKind.String,
        };
    }
    return logsModelMeta;
}
//# sourceMappingURL=logs_model.js.map