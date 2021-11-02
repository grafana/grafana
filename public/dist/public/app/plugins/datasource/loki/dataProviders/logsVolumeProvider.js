import { __assign, __values } from "tslib";
import { FieldCache, FieldColorModeId, FieldType, getLogLevelFromKey, LoadingState, LogLevel, MutableDataFrame, toDataFrame, } from '@grafana/data';
import { Observable, throwError, timeout } from 'rxjs';
import { cloneDeep } from 'lodash';
import { isMetricsQuery } from '../datasource';
import { LogLevelColor } from '../../../../core/logs_model';
import { BarAlignment, GraphDrawStyle, StackingMode } from '@grafana/schema';
var SECOND = 1000;
var MINUTE = 60 * SECOND;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
/**
 * Logs volume query may be expensive as it requires counting all logs in the selected range. If such query
 * takes too much time it may need be made more specific to limit number of logs processed under the hood.
 */
var TIMEOUT = 10 * SECOND;
export function createLokiLogsVolumeProvider(datasource, dataQueryRequest) {
    var logsVolumeRequest = cloneDeep(dataQueryRequest);
    var intervalInfo = getIntervalInfo(dataQueryRequest.scopedVars);
    logsVolumeRequest.targets = logsVolumeRequest.targets
        .filter(function (target) { return target.expr && !isMetricsQuery(target.expr); })
        .map(function (target) {
        return __assign(__assign({}, target), { instant: false, expr: "sum by (level) (count_over_time(" + target.expr + "[" + intervalInfo.interval + "]))" });
    });
    logsVolumeRequest.interval = intervalInfo.interval;
    if (intervalInfo.intervalMs !== undefined) {
        logsVolumeRequest.intervalMs = intervalInfo.intervalMs;
    }
    return new Observable(function (observer) {
        var rawLogsVolume = [];
        observer.next({
            state: LoadingState.Loading,
            error: undefined,
            data: [],
        });
        var subscription = datasource
            .query(logsVolumeRequest)
            .pipe(timeout({
            each: TIMEOUT,
            with: function () {
                return throwError(new Error('Request timed-out. Please try making your query more specific or narrow selected time range and try again.'));
            },
        }))
            .subscribe({
            complete: function () {
                var aggregatedLogsVolume = aggregateRawLogsVolume(rawLogsVolume);
                if (aggregatedLogsVolume[0]) {
                    aggregatedLogsVolume[0].meta = {
                        custom: {
                            targets: dataQueryRequest.targets,
                            absoluteRange: { from: dataQueryRequest.range.from.valueOf(), to: dataQueryRequest.range.to.valueOf() },
                        },
                    };
                }
                observer.next({
                    state: LoadingState.Done,
                    error: undefined,
                    data: aggregatedLogsVolume,
                });
                observer.complete();
            },
            next: function (dataQueryResponse) {
                rawLogsVolume = rawLogsVolume.concat(dataQueryResponse.data.map(toDataFrame));
            },
            error: function (error) {
                observer.next({
                    state: LoadingState.Error,
                    error: error,
                    data: [],
                });
                observer.error(error);
            },
        });
        return function () {
            subscription === null || subscription === void 0 ? void 0 : subscription.unsubscribe();
        };
    });
}
/**
 * Add up values for the same level and create a single data frame for each level
 */
function aggregateRawLogsVolume(rawLogsVolume) {
    var logsVolumeByLevelMap = {};
    var levels = 0;
    rawLogsVolume.forEach(function (dataFrame) {
        var valueField;
        try {
            valueField = new FieldCache(dataFrame).getFirstFieldOfType(FieldType.number);
        }
        catch (_a) { }
        // If value field doesn't exist skip the frame (it may happen with instant queries)
        if (!valueField) {
            return;
        }
        var level = valueField.labels ? getLogLevelFromLabels(valueField.labels) : LogLevel.unknown;
        if (!logsVolumeByLevelMap[level]) {
            logsVolumeByLevelMap[level] = [];
            levels++;
        }
        logsVolumeByLevelMap[level].push(dataFrame);
    });
    return Object.keys(logsVolumeByLevelMap).map(function (level) {
        return aggregateFields(logsVolumeByLevelMap[level], getFieldConfig(level, levels));
    });
}
function getFieldConfig(level, levels) {
    var name = levels === 1 && level === LogLevel.unknown ? 'logs' : level;
    var color = LogLevelColor[level];
    return {
        displayNameFromDS: name,
        color: {
            mode: FieldColorModeId.Fixed,
            fixedColor: color,
        },
        custom: {
            drawStyle: GraphDrawStyle.Bars,
            barAlignment: BarAlignment.Center,
            lineColor: color,
            pointColor: color,
            fillColor: color,
            lineWidth: 1,
            fillOpacity: 100,
            stacking: {
                mode: StackingMode.Normal,
                group: 'A',
            },
        },
    };
}
/**
 * Create a new data frame with a single field and values creating by adding field values
 * from all provided data frames
 */
function aggregateFields(dataFrames, config) {
    var aggregatedDataFrame = new MutableDataFrame();
    if (!dataFrames.length) {
        return aggregatedDataFrame;
    }
    var totalLength = dataFrames[0].length;
    var timeField = new FieldCache(dataFrames[0]).getFirstFieldOfType(FieldType.time);
    if (!timeField) {
        return aggregatedDataFrame;
    }
    aggregatedDataFrame.addField({ name: 'Time', type: FieldType.time }, totalLength);
    aggregatedDataFrame.addField({ name: 'Value', type: FieldType.number, config: config }, totalLength);
    dataFrames.forEach(function (dataFrame) {
        dataFrame.fields.forEach(function (field) {
            if (field.type === FieldType.number) {
                for (var pointIndex = 0; pointIndex < totalLength; pointIndex++) {
                    var currentValue = aggregatedDataFrame.get(pointIndex).Value;
                    var valueToAdd = field.values.get(pointIndex);
                    var totalValue = currentValue === null && valueToAdd === null ? null : (currentValue || 0) + (valueToAdd || 0);
                    aggregatedDataFrame.set(pointIndex, { Value: totalValue, Time: timeField.values.get(pointIndex) });
                }
            }
        });
    });
    return aggregatedDataFrame;
}
function getLogLevelFromLabels(labels) {
    var e_1, _a;
    var labelNames = ['level', 'lvl', 'loglevel'];
    var levelLabel;
    try {
        for (var labelNames_1 = __values(labelNames), labelNames_1_1 = labelNames_1.next(); !labelNames_1_1.done; labelNames_1_1 = labelNames_1.next()) {
            var labelName = labelNames_1_1.value;
            if (labelName in labels) {
                levelLabel = labelName;
                break;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (labelNames_1_1 && !labelNames_1_1.done && (_a = labelNames_1.return)) _a.call(labelNames_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return levelLabel ? getLogLevelFromKey(labels[levelLabel]) : LogLevel.unknown;
}
function getIntervalInfo(scopedVars) {
    if (scopedVars.__interval) {
        var intervalMs = scopedVars.__interval_ms.value;
        var interval = '';
        if (intervalMs > HOUR) {
            intervalMs = DAY;
            interval = '1d';
        }
        else if (intervalMs > MINUTE) {
            intervalMs = HOUR;
            interval = '1h';
        }
        else if (intervalMs > SECOND) {
            intervalMs = MINUTE;
            interval = '1m';
        }
        else {
            intervalMs = SECOND;
            interval = '1s';
        }
        return { interval: interval, intervalMs: intervalMs };
    }
    else {
        return { interval: '$__interval' };
    }
}
//# sourceMappingURL=logsVolumeProvider.js.map