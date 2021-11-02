import { __assign, __read, __spreadArray, __values } from "tslib";
import { capitalize, groupBy, isEmpty } from 'lodash';
import { v5 as uuidv5 } from 'uuid';
import { of } from 'rxjs';
import { FieldType, ArrayVector, MutableDataFrame, findUniqueLabels, DataFrameView, } from '@grafana/data';
import { getTemplateSrv, getDataSourceSrv } from '@grafana/runtime';
import TableModel from 'app/core/table_model';
import { formatQuery, getHighlighterExpressionsFromQuery } from './query_utils';
import { LokiResultType, } from './types';
var UUID_NAMESPACE = '6ec946da-0f49-47a8-983a-1d76d17e7c92';
/**
 * Transforms LokiStreamResult structure into a dataFrame. Used when doing standard queries and newer version of Loki.
 */
export function lokiStreamResultToDataFrame(stream, reverse, refId) {
    var e_1, _a;
    var labels = stream.stream;
    var labelsString = Object.entries(labels)
        .map(function (_a) {
        var _b = __read(_a, 2), key = _b[0], val = _b[1];
        return key + "=\"" + val + "\"";
    })
        .sort()
        .join('');
    var times = new ArrayVector([]);
    var timesNs = new ArrayVector([]);
    var lines = new ArrayVector([]);
    var uids = new ArrayVector([]);
    // We need to store and track all used uids to ensure that uids are unique
    var usedUids = {};
    try {
        for (var _b = __values(stream.values), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), ts = _d[0], line = _d[1];
            // num ns epoch in string, we convert it to iso string here so it matches old format
            times.add(new Date(parseInt(ts.substr(0, ts.length - 6), 10)).toISOString());
            timesNs.add(ts);
            lines.add(line);
            uids.add(createUid(ts, labelsString, line, usedUids, refId));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return constructDataFrame(times, timesNs, lines, uids, labels, reverse, refId);
}
/**
 * Constructs dataFrame with supplied fields and other data. Also makes sure it is properly reversed if needed.
 */
function constructDataFrame(times, timesNs, lines, uids, labels, reverse, refId) {
    var dataFrame = {
        refId: refId,
        fields: [
            { name: 'ts', type: FieldType.time, config: { displayName: 'Time' }, values: times },
            { name: 'line', type: FieldType.string, config: {}, values: lines, labels: labels },
            { name: 'id', type: FieldType.string, config: {}, values: uids },
            { name: 'tsNs', type: FieldType.time, config: { displayName: 'Time ns' }, values: timesNs }, // Time
        ],
        length: times.length,
    };
    if (reverse) {
        var mutableDataFrame = new MutableDataFrame(dataFrame);
        mutableDataFrame.reverse();
        return mutableDataFrame;
    }
    return dataFrame;
}
/**
 * Transform LokiResponse data and appends it to MutableDataFrame. Used for streaming where the dataFrame can be
 * a CircularDataFrame creating a fixed size rolling buffer.
 * TODO: Probably could be unified with the logStreamToDataFrame function.
 * @param response
 * @param data Needs to have ts, line, labels, id as fields
 */
export function appendResponseToBufferedData(response, data) {
    // Should we do anything with: response.dropped_entries?
    var e_2, _a, e_3, _b, e_4, _c;
    var streams = response.streams;
    if (!streams || !streams.length) {
        return;
    }
    var baseLabels = {};
    try {
        for (var _d = __values(data.fields), _e = _d.next(); !_e.done; _e = _d.next()) {
            var f = _e.value;
            if (f.type === FieldType.string) {
                if (f.labels) {
                    baseLabels = f.labels;
                }
                break;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
        }
        finally { if (e_2) throw e_2.error; }
    }
    var tsField = data.fields[0];
    var tsNsField = data.fields[1];
    var lineField = data.fields[2];
    var labelsField = data.fields[3];
    var idField = data.fields[4];
    // We are comparing used ids only within the received stream. This could be a problem if the same line + labels + nanosecond timestamp came in 2 separate batches.
    // As this is very unlikely, and the result would only affect live-tailing css animation we have decided to not compare all received uids from data param as this would slow down processing.
    var usedUids = {};
    try {
        for (var streams_1 = __values(streams), streams_1_1 = streams_1.next(); !streams_1_1.done; streams_1_1 = streams_1.next()) {
            var stream = streams_1_1.value;
            // Find unique labels
            var unique = findUniqueLabels(stream.stream, baseLabels);
            var allLabelsString = Object.entries(stream.stream)
                .map(function (_a) {
                var _b = __read(_a, 2), key = _b[0], val = _b[1];
                return key + "=\"" + val + "\"";
            })
                .sort()
                .join('');
            try {
                // Add each line
                for (var _f = (e_4 = void 0, __values(stream.values)), _g = _f.next(); !_g.done; _g = _f.next()) {
                    var _h = __read(_g.value, 2), ts = _h[0], line = _h[1];
                    tsField.values.add(new Date(parseInt(ts.substr(0, ts.length - 6), 10)).toISOString());
                    tsNsField.values.add(ts);
                    lineField.values.add(line);
                    labelsField.values.add(unique);
                    idField.values.add(createUid(ts, allLabelsString, line, usedUids, data.refId));
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_g && !_g.done && (_c = _f.return)) _c.call(_f);
                }
                finally { if (e_4) throw e_4.error; }
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (streams_1_1 && !streams_1_1.done && (_b = streams_1.return)) _b.call(streams_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
}
function createUid(ts, labelsString, line, usedUids, refId) {
    // Generate id as hashed nanosecond timestamp, labels and line (this does not have to be unique)
    var id = uuidv5(ts + "_" + labelsString + "_" + line, UUID_NAMESPACE);
    // Check if generated id is unique
    // If not and we've already used it, append it's count after it
    if (id in usedUids) {
        // Increase the count
        var newCount = usedUids[id] + 1;
        usedUids[id] = newCount;
        // Append count to generated id to make it unique
        id = id + "_" + newCount;
    }
    else {
        // If id is unique and wasn't used, add it to usedUids and start count at 0
        usedUids[id] = 0;
    }
    // Return unique id
    if (refId) {
        return id + "_" + refId;
    }
    return id;
}
function lokiMatrixToTimeSeries(matrixResult, options) {
    var name = createMetricLabel(matrixResult.metric, options);
    return {
        target: name,
        title: name,
        datapoints: lokiPointsToTimeseriesPoints(matrixResult.values, options),
        tags: matrixResult.metric,
        meta: options.meta,
        refId: options.refId,
    };
}
export function lokiPointsToTimeseriesPoints(data, options) {
    var e_5, _a;
    var stepMs = options.step * 1000;
    var datapoints = [];
    var baseTimestampMs = options.start / 1e6;
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var _b = __read(data_1_1.value, 2), time = _b[0], value = _b[1];
            var datapointValue = parseFloat(value);
            if (isNaN(datapointValue)) {
                datapointValue = null;
            }
            var timestamp = time * 1000;
            for (var t = baseTimestampMs; t < timestamp; t += stepMs) {
                datapoints.push([null, t]);
            }
            baseTimestampMs = timestamp + stepMs;
            datapoints.push([datapointValue, timestamp]);
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_5) throw e_5.error; }
    }
    var endTimestamp = options.end / 1e6;
    for (var t = baseTimestampMs; t <= endTimestamp; t += stepMs) {
        datapoints.push([null, t]);
    }
    return datapoints;
}
export function lokiResultsToTableModel(lokiResults, resultCount, refId, meta, valueWithRefId) {
    if (!lokiResults || lokiResults.length === 0) {
        return new TableModel();
    }
    // Collect all labels across all metrics
    var metricLabels = new Set(lokiResults.reduce(function (acc, cur) { return acc.concat(Object.keys(cur.metric)); }, []));
    // Sort metric labels, create columns for them and record their index
    var sortedLabels = __spreadArray([], __read(metricLabels.values()), false).sort();
    var table = new TableModel();
    table.refId = refId;
    table.meta = meta;
    table.columns = __spreadArray(__spreadArray([
        { text: 'Time', type: FieldType.time }
    ], __read(sortedLabels.map(function (label) { return ({ text: label, filterable: true, type: FieldType.string }); })), false), [
        { text: resultCount > 1 || valueWithRefId ? "Value #" + refId : 'Value', type: FieldType.number },
    ], false);
    // Populate rows, set value to empty string when label not present.
    lokiResults.forEach(function (series) {
        var _a;
        var newSeries = {
            metric: series.metric,
            values: series.value
                ? [series.value]
                : series.values,
        };
        if (!newSeries.values) {
            return;
        }
        if (!newSeries.metric) {
            table.rows.concat(newSeries.values.map(function (_a) {
                var _b = __read(_a, 2), a = _b[0], b = _b[1];
                return [a * 1000, parseFloat(b)];
            }));
        }
        else {
            (_a = table.rows).push.apply(_a, __spreadArray([], __read(newSeries.values.map(function (_a) {
                var _b = __read(_a, 2), a = _b[0], b = _b[1];
                return __spreadArray(__spreadArray([
                    a * 1000
                ], __read(sortedLabels.map(function (label) { return newSeries.metric[label] || ''; })), false), [
                    parseFloat(b),
                ], false);
            })), false));
        }
    });
    return table;
}
export function createMetricLabel(labelData, options) {
    var _a;
    var label = options === undefined || isEmpty(options.legendFormat)
        ? getOriginalMetricName(labelData)
        : renderTemplate(getTemplateSrv().replace((_a = options.legendFormat) !== null && _a !== void 0 ? _a : '', options.scopedVars), labelData);
    if (!label && options) {
        label = options.query;
    }
    return label;
}
function renderTemplate(aliasPattern, aliasData) {
    var aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
    return aliasPattern.replace(aliasRegex, function (_, g1) { return (aliasData[g1] ? aliasData[g1] : g1); });
}
function getOriginalMetricName(labelData) {
    var metricName = labelData.__name__ || '';
    delete labelData.__name__;
    var labelPart = Object.entries(labelData)
        .map(function (label) { return label[0] + "=\"" + label[1] + "\""; })
        .join(',');
    return metricName + "{" + labelPart + "}";
}
export function decamelize(s) {
    return s.replace(/[A-Z]/g, function (m) { return " " + m.toLowerCase(); });
}
// Turn loki stats { metric: value } into meta stat { title: metric, value: value }
function lokiStatsToMetaStat(stats) {
    var result = [];
    if (!stats) {
        return result;
    }
    for (var section in stats) {
        var values = stats[section];
        for (var label in values) {
            var value = values[label];
            var unit = void 0;
            if (/time/i.test(label) && value) {
                unit = 's';
            }
            else if (/bytes.*persecond/i.test(label)) {
                unit = 'Bps';
            }
            else if (/bytes/i.test(label)) {
                unit = 'decbytes';
            }
            var title = capitalize(section) + ": " + decamelize(label);
            result.push({ displayName: title, value: value, unit: unit });
        }
    }
    return result;
}
export function lokiStreamsToDataFrames(response, target, limit, config, reverse) {
    if (reverse === void 0) { reverse = false; }
    var data = limit > 0 ? response.data.result : [];
    var stats = lokiStatsToMetaStat(response.data.stats);
    // Use custom mechanism to identify which stat we want to promote to label
    var custom = {
        lokiQueryStatKey: 'Summary: total bytes processed',
    };
    var meta = {
        searchWords: getHighlighterExpressionsFromQuery(formatQuery(target.expr)),
        limit: limit,
        stats: stats,
        custom: custom,
        preferredVisualisationType: 'logs',
    };
    var series = data.map(function (stream) {
        var dataFrame = lokiStreamResultToDataFrame(stream, reverse, target.refId);
        enhanceDataFrame(dataFrame, config);
        if (meta.custom && dataFrame.fields.some(function (f) { return f.labels && Object.keys(f.labels).some(function (l) { return l === '__error__'; }); })) {
            meta.custom.error = 'Error when parsing some of the logs';
        }
        return __assign(__assign({}, dataFrame), { refId: target.refId, meta: meta });
    });
    if (stats.length && !data.length) {
        return [
            {
                fields: [],
                length: 0,
                refId: target.refId,
                meta: meta,
            },
        ];
    }
    return series;
}
/**
 * Adds new fields and DataLinks to DataFrame based on DataSource instance config.
 */
export var enhanceDataFrame = function (dataFrame, config) {
    var _a;
    if (!config) {
        return;
    }
    var derivedFields = (_a = config.derivedFields) !== null && _a !== void 0 ? _a : [];
    if (!derivedFields.length) {
        return;
    }
    var derivedFieldsGrouped = groupBy(derivedFields, 'name');
    var newFields = Object.values(derivedFieldsGrouped).map(fieldFromDerivedFieldConfig);
    var view = new DataFrameView(dataFrame);
    view.forEach(function (row) {
        var e_6, _a;
        try {
            for (var newFields_1 = __values(newFields), newFields_1_1 = newFields_1.next(); !newFields_1_1.done; newFields_1_1 = newFields_1.next()) {
                var field = newFields_1_1.value;
                var logMatch = row.line.match(derivedFieldsGrouped[field.name][0].matcherRegex);
                field.values.add(logMatch && logMatch[1]);
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (newFields_1_1 && !newFields_1_1.done && (_a = newFields_1.return)) _a.call(newFields_1);
            }
            finally { if (e_6) throw e_6.error; }
        }
    });
    dataFrame.fields = __spreadArray(__spreadArray([], __read(dataFrame.fields), false), __read(newFields), false);
};
/**
 * Transform derivedField config into dataframe field with config that contains link.
 */
function fieldFromDerivedFieldConfig(derivedFieldConfigs) {
    var dataSourceSrv = getDataSourceSrv();
    var dataLinks = derivedFieldConfigs.reduce(function (acc, derivedFieldConfig) {
        var _a;
        // Having field.datasourceUid means it is an internal link.
        if (derivedFieldConfig.datasourceUid) {
            var dsSettings = dataSourceSrv.getInstanceSettings(derivedFieldConfig.datasourceUid);
            acc.push({
                // Will be filled out later
                title: derivedFieldConfig.urlDisplayLabel || '',
                url: '',
                // This is hardcoded for Jaeger or Zipkin not way right now to specify datasource specific query object
                internal: {
                    query: { query: derivedFieldConfig.url },
                    datasourceUid: derivedFieldConfig.datasourceUid,
                    datasourceName: (_a = dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.name) !== null && _a !== void 0 ? _a : 'Data source not found',
                },
            });
        }
        else if (derivedFieldConfig.url) {
            acc.push({
                // We do not know what title to give here so we count on presentation layer to create a title from metadata.
                title: derivedFieldConfig.urlDisplayLabel || '',
                // This is hardcoded for Jaeger or Zipkin not way right now to specify datasource specific query object
                url: derivedFieldConfig.url,
            });
        }
        return acc;
    }, []);
    return {
        name: derivedFieldConfigs[0].name,
        type: FieldType.string,
        config: {
            links: dataLinks,
        },
        // We are adding values later on
        values: new ArrayVector([]),
    };
}
export function rangeQueryResponseToTimeSeries(response, query, target, responseListLength, scopedVars) {
    var _a;
    /** Show results of Loki metric queries only in graph */
    var meta = {
        preferredVisualisationType: 'graph',
    };
    var transformerOptions = {
        format: target.format,
        legendFormat: (_a = target.legendFormat) !== null && _a !== void 0 ? _a : '',
        start: query.start,
        end: query.end,
        step: query.step,
        query: query.query,
        responseListLength: responseListLength,
        refId: target.refId,
        meta: meta,
        valueWithRefId: target.valueWithRefId,
        scopedVars: scopedVars,
    };
    switch (response.data.resultType) {
        case LokiResultType.Vector:
            return response.data.result.map(function (vecResult) {
                return lokiMatrixToTimeSeries({ metric: vecResult.metric, values: [vecResult.value] }, transformerOptions);
            });
        case LokiResultType.Matrix:
            return response.data.result.map(function (matrixResult) { return lokiMatrixToTimeSeries(matrixResult, transformerOptions); });
        default:
            return [];
    }
}
export function processRangeQueryResponse(response, target, query, responseListLength, limit, config, scopedVars, reverse) {
    if (reverse === void 0) { reverse = false; }
    switch (response.data.resultType) {
        case LokiResultType.Stream:
            return of({
                data: lokiStreamsToDataFrames(response, target, limit, config, reverse),
                key: target.refId + "_log",
            });
        case LokiResultType.Vector:
        case LokiResultType.Matrix:
            return of({
                data: rangeQueryResponseToTimeSeries(response, query, __assign(__assign({}, target), { format: 'time_series' }), responseListLength, scopedVars),
                key: target.refId,
            });
        default:
            throw new Error("Unknown result type \"" + response.data.resultType + "\".");
    }
}
//# sourceMappingURL=result_transformer.js.map