import { __assign, __read, __rest, __spreadArray, __values } from "tslib";
import { ArrayDataFrame, ArrayVector, DataTopic, FieldType, formatLabels, getDisplayProcessor, TIME_SERIES_TIME_FIELD_NAME, TIME_SERIES_VALUE_FIELD_NAME, CoreApp, } from '@grafana/data';
import { getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
import { partition, groupBy } from 'lodash';
import { descending, deviation } from 'd3';
import { isExemplarData, isMatrixData, } from './types';
var POSITIVE_INFINITY_SAMPLE_VALUE = '+Inf';
var NEGATIVE_INFINITY_SAMPLE_VALUE = '-Inf';
var isTableResult = function (dataFrame, options) {
    var _a, _b;
    // We want to process instant results in Explore as table
    if ((options.app === CoreApp.Explore && ((_b = (_a = dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.resultType)) === 'vector') {
        return true;
    }
    // We want to process all dataFrames with target.format === 'table' as table
    var target = options.targets.find(function (target) { return target.refId === dataFrame.refId; });
    return (target === null || target === void 0 ? void 0 : target.format) === 'table';
};
var isHeatmapResult = function (dataFrame, options) {
    var target = options.targets.find(function (target) { return target.refId === dataFrame.refId; });
    return (target === null || target === void 0 ? void 0 : target.format) === 'heatmap';
};
// V2 result trasnformer used to transform query results from queries that were run trough prometheus backend
export function transformV2(response, request, options) {
    var _a = __read(partition(response.data, function (df) { return isTableResult(df, request); }), 2), tableFrames = _a[0], framesWithoutTable = _a[1];
    var processedTableFrames = transformDFToTable(tableFrames);
    var _b = __read(partition(framesWithoutTable, function (df) {
        return isHeatmapResult(df, request);
    }), 2), heatmapResults = _b[0], framesWithoutTableAndHeatmaps = _b[1];
    var processedHeatmapFrames = transformToHistogramOverTime(heatmapResults.sort(sortSeriesByLabel));
    var _c = __read(partition(framesWithoutTableAndHeatmaps, function (df) { var _a, _b; return ((_b = (_a = df.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.resultType) === 'exemplar'; }), 2), exemplarFrames = _c[0], framesWithoutTableHeatmapsAndExemplars = _c[1];
    // EXEMPLAR FRAMES: We enrich exemplar frames with data links and add dataTopic meta info
    var destinations = options.exemplarTraceIdDestinations;
    var processedExemplarFrames = exemplarFrames.map(function (dataFrame) {
        var e_1, _a;
        var _b;
        if (destinations === null || destinations === void 0 ? void 0 : destinations.length) {
            var _loop_1 = function (exemplarTraceIdDestination) {
                var traceIDField = dataFrame.fields.find(function (field) { return field.name === exemplarTraceIdDestination.name; });
                if (traceIDField) {
                    var links = getDataLinks(exemplarTraceIdDestination);
                    traceIDField.config.links = ((_b = traceIDField.config.links) === null || _b === void 0 ? void 0 : _b.length)
                        ? __spreadArray(__spreadArray([], __read(traceIDField.config.links), false), __read(links), false) : links;
                }
            };
            try {
                for (var destinations_1 = __values(destinations), destinations_1_1 = destinations_1.next(); !destinations_1_1.done; destinations_1_1 = destinations_1.next()) {
                    var exemplarTraceIdDestination = destinations_1_1.value;
                    _loop_1(exemplarTraceIdDestination);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (destinations_1_1 && !destinations_1_1.done && (_a = destinations_1.return)) _a.call(destinations_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        return __assign(__assign({}, dataFrame), { meta: __assign(__assign({}, dataFrame.meta), { dataTopic: DataTopic.Annotations }) });
    });
    // Everything else is processed as time_series result and graph preferredVisualisationType
    var otherFrames = framesWithoutTableHeatmapsAndExemplars.map(function (dataFrame) {
        var df = __assign(__assign({}, dataFrame), { meta: __assign(__assign({}, dataFrame.meta), { preferredVisualisationType: 'graph' }) });
        return df;
    });
    return __assign(__assign({}, response), { data: __spreadArray(__spreadArray(__spreadArray(__spreadArray([], __read(otherFrames), false), __read(processedTableFrames), false), __read(processedHeatmapFrames), false), __read(processedExemplarFrames), false) });
}
export function transformDFToTable(dfs) {
    // If no dataFrames or if 1 dataFrames with no values, return original dataFrame
    if (dfs.length === 0 || (dfs.length === 1 && dfs[0].length === 0)) {
        return dfs;
    }
    // Group results by refId and process dataFrames with the same refId as 1 dataFrame
    var dataFramesByRefId = groupBy(dfs, 'refId');
    var frames = Object.keys(dataFramesByRefId).map(function (refId) {
        // Create timeField, valueField and labelFields
        var valueText = getValueText(dfs.length, refId);
        var valueField = getValueField({ data: [], valueName: valueText });
        var timeField = getTimeField([]);
        var labelFields = [];
        // Fill labelsFields with labels from dataFrames
        dataFramesByRefId[refId].forEach(function (df) {
            var _a;
            var frameValueField = df.fields[1];
            var promLabels = (_a = frameValueField.labels) !== null && _a !== void 0 ? _a : {};
            Object.keys(promLabels)
                .sort()
                .forEach(function (label) {
                // If we don't have label in labelFields, add it
                if (!labelFields.some(function (l) { return l.name === label; })) {
                    var numberField = label === 'le';
                    labelFields.push({
                        name: label,
                        config: { filterable: true },
                        type: numberField ? FieldType.number : FieldType.string,
                        values: new ArrayVector(),
                    });
                }
            });
        });
        // Fill valueField, timeField and labelFields with values
        dataFramesByRefId[refId].forEach(function (df) {
            df.fields[0].values.toArray().forEach(function (value) { return timeField.values.add(value); });
            df.fields[1].values.toArray().forEach(function (value) {
                var _a;
                valueField.values.add(parseSampleValue(value));
                var labelsForField = (_a = df.fields[1].labels) !== null && _a !== void 0 ? _a : {};
                labelFields.forEach(function (field) { return field.values.add(getLabelValue(labelsForField, field.name)); });
            });
        });
        var fields = __spreadArray(__spreadArray([timeField], __read(labelFields), false), [valueField], false);
        return {
            refId: refId,
            fields: fields,
            meta: __assign(__assign({}, dfs[0].meta), { preferredVisualisationType: 'table' }),
            length: timeField.values.length,
        };
    });
    return frames;
}
function getValueText(responseLength, refId) {
    if (refId === void 0) { refId = ''; }
    return responseLength > 1 ? "Value #" + refId : 'Value';
}
export function transform(response, transformOptions) {
    var e_2, _a;
    var _b, _c;
    // Create options object from transformOptions
    var options = {
        format: transformOptions.target.format,
        step: transformOptions.query.step,
        legendFormat: transformOptions.target.legendFormat,
        start: transformOptions.query.start,
        end: transformOptions.query.end,
        query: transformOptions.query.expr,
        responseListLength: transformOptions.responseListLength,
        scopedVars: transformOptions.scopedVars,
        refId: transformOptions.target.refId,
        valueWithRefId: transformOptions.target.valueWithRefId,
        meta: {
            // Fix for showing of Prometheus results in Explore table
            preferredVisualisationType: transformOptions.query.instant ? 'table' : 'graph',
        },
    };
    var prometheusResult = response.data.data;
    if (isExemplarData(prometheusResult)) {
        var events_1 = [];
        prometheusResult.forEach(function (exemplarData) {
            var data = exemplarData.exemplars.map(function (exemplar) {
                var _a;
                return __assign(__assign((_a = {}, _a[TIME_SERIES_TIME_FIELD_NAME] = exemplar.timestamp * 1000, _a[TIME_SERIES_VALUE_FIELD_NAME] = exemplar.value, _a), exemplar.labels), exemplarData.seriesLabels);
            });
            events_1.push.apply(events_1, __spreadArray([], __read(data), false));
        });
        // Grouping exemplars by step
        var sampledExemplars = sampleExemplars(events_1, options);
        var dataFrame_1 = new ArrayDataFrame(sampledExemplars);
        dataFrame_1.meta = { dataTopic: DataTopic.Annotations };
        // Add data links if configured
        if ((_b = transformOptions.exemplarTraceIdDestinations) === null || _b === void 0 ? void 0 : _b.length) {
            var _loop_2 = function (exemplarTraceIdDestination) {
                var traceIDField = dataFrame_1.fields.find(function (field) { return field.name === exemplarTraceIdDestination.name; });
                if (traceIDField) {
                    var links = getDataLinks(exemplarTraceIdDestination);
                    traceIDField.config.links = ((_c = traceIDField.config.links) === null || _c === void 0 ? void 0 : _c.length)
                        ? __spreadArray(__spreadArray([], __read(traceIDField.config.links), false), __read(links), false) : links;
                }
            };
            try {
                for (var _d = __values(transformOptions.exemplarTraceIdDestinations), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var exemplarTraceIdDestination = _e.value;
                    _loop_2(exemplarTraceIdDestination);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        return [dataFrame_1];
    }
    if (!(prometheusResult === null || prometheusResult === void 0 ? void 0 : prometheusResult.result)) {
        return [];
    }
    // Return early if result type is scalar
    if (prometheusResult.resultType === 'scalar') {
        return [
            {
                meta: options.meta,
                refId: options.refId,
                length: 1,
                fields: [getTimeField([prometheusResult.result]), getValueField({ data: [prometheusResult.result] })],
            },
        ];
    }
    // Return early again if the format is table, this needs special transformation.
    if (options.format === 'table') {
        var tableData = transformMetricDataToTable(prometheusResult.result, options);
        return [tableData];
    }
    // Process matrix and vector results to DataFrame
    var dataFrame = [];
    prometheusResult.result.forEach(function (data) { return dataFrame.push(transformToDataFrame(data, options)); });
    // When format is heatmap use the already created data frames and transform it more
    if (options.format === 'heatmap') {
        dataFrame.sort(sortSeriesByLabel);
        var seriesList = transformToHistogramOverTime(dataFrame);
        return seriesList;
    }
    // Return matrix or vector result as DataFrame[]
    return dataFrame;
}
function getDataLinks(options) {
    var _a;
    var dataLinks = [];
    if (options.datasourceUid) {
        var dataSourceSrv = getDataSourceSrv();
        var dsSettings = dataSourceSrv.getInstanceSettings(options.datasourceUid);
        dataLinks.push({
            title: "Query with " + (dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.name),
            url: '',
            internal: {
                query: { query: '${__value.raw}', queryType: 'traceId' },
                datasourceUid: options.datasourceUid,
                datasourceName: (_a = dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.name) !== null && _a !== void 0 ? _a : 'Data source not found',
            },
        });
    }
    if (options.url) {
        dataLinks.push({
            title: "Go to " + options.url,
            url: options.url,
            targetBlank: true,
        });
    }
    return dataLinks;
}
/**
 * Reduce the density of the exemplars by making sure that the highest value exemplar is included
 * and then only the ones that are 2 times the standard deviation of the all the values.
 * This makes sure not to show too many dots near each other.
 */
function sampleExemplars(events, options) {
    var e_3, _a, e_4, _b;
    var step = options.step || 15;
    var bucketedExemplars = {};
    var values = [];
    try {
        for (var events_2 = __values(events), events_2_1 = events_2.next(); !events_2_1.done; events_2_1 = events_2.next()) {
            var exemplar = events_2_1.value;
            // Align exemplar timestamp to nearest step second
            var alignedTs = String(Math.floor(exemplar[TIME_SERIES_TIME_FIELD_NAME] / 1000 / step) * step * 1000);
            if (!bucketedExemplars[alignedTs]) {
                // New bucket found
                bucketedExemplars[alignedTs] = [];
            }
            bucketedExemplars[alignedTs].push(exemplar);
            values.push(exemplar[TIME_SERIES_VALUE_FIELD_NAME]);
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (events_2_1 && !events_2_1.done && (_a = events_2.return)) _a.call(events_2);
        }
        finally { if (e_3) throw e_3.error; }
    }
    // Getting exemplars from each bucket
    var standardDeviation = deviation(values);
    var sampledBuckets = Object.keys(bucketedExemplars).sort();
    var sampledExemplars = [];
    var _loop_3 = function (ts) {
        var exemplarsInBucket = bucketedExemplars[ts];
        if (exemplarsInBucket.length === 1) {
            sampledExemplars.push(exemplarsInBucket[0]);
        }
        else {
            // Choose which values to sample
            var bucketValues = exemplarsInBucket.map(function (ex) { return ex[TIME_SERIES_VALUE_FIELD_NAME]; }).sort(descending);
            var sampledBucketValues = bucketValues.reduce(function (acc, curr) {
                if (acc.length === 0) {
                    // First value is max and is always added
                    acc.push(curr);
                }
                else {
                    // Then take values only when at least 2 standard deviation distance to previously taken value
                    var prev = acc[acc.length - 1];
                    if (standardDeviation && prev - curr >= 2 * standardDeviation) {
                        acc.push(curr);
                    }
                }
                return acc;
            }, []);
            // Find the exemplars for the sampled values
            sampledExemplars.push.apply(sampledExemplars, __spreadArray([], __read(sampledBucketValues.map(function (value) { return exemplarsInBucket.find(function (ex) { return ex[TIME_SERIES_VALUE_FIELD_NAME] === value; }); })), false));
        }
    };
    try {
        for (var sampledBuckets_1 = __values(sampledBuckets), sampledBuckets_1_1 = sampledBuckets_1.next(); !sampledBuckets_1_1.done; sampledBuckets_1_1 = sampledBuckets_1.next()) {
            var ts = sampledBuckets_1_1.value;
            _loop_3(ts);
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (sampledBuckets_1_1 && !sampledBuckets_1_1.done && (_b = sampledBuckets_1.return)) _b.call(sampledBuckets_1);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return sampledExemplars;
}
/**
 * Transforms matrix and vector result from Prometheus result to DataFrame
 */
function transformToDataFrame(data, options) {
    var e_5, _a;
    var _b = createLabelInfo(data.metric, options), name = _b.name, labels = _b.labels;
    var fields = [];
    if (isMatrixData(data)) {
        var stepMs = options.step ? options.step * 1000 : NaN;
        var baseTimestamp = options.start * 1000;
        var dps = [];
        try {
            for (var _c = __values(data.values), _d = _c.next(); !_d.done; _d = _c.next()) {
                var value = _d.value;
                var dpValue = parseSampleValue(value[1]);
                if (isNaN(dpValue)) {
                    dpValue = null;
                }
                var timestamp = value[0] * 1000;
                for (var t = baseTimestamp; t < timestamp; t += stepMs) {
                    dps.push([t, null]);
                }
                baseTimestamp = timestamp + stepMs;
                dps.push([timestamp, dpValue]);
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_5) throw e_5.error; }
        }
        var endTimestamp = options.end * 1000;
        for (var t = baseTimestamp; t <= endTimestamp; t += stepMs) {
            dps.push([t, null]);
        }
        fields.push(getTimeField(dps, true));
        fields.push(getValueField({ data: dps, parseValue: false, labels: labels, displayNameFromDS: name }));
    }
    else {
        fields.push(getTimeField([data.value]));
        fields.push(getValueField({ data: [data.value], labels: labels, displayNameFromDS: name }));
    }
    return {
        meta: options.meta,
        refId: options.refId,
        length: fields[0].values.length,
        fields: fields,
        name: name,
    };
}
function transformMetricDataToTable(md, options) {
    if (!md || md.length === 0) {
        return {
            meta: options.meta,
            refId: options.refId,
            length: 0,
            fields: [],
        };
    }
    var valueText = options.responseListLength > 1 || options.valueWithRefId ? "Value #" + options.refId : 'Value';
    var timeField = getTimeField([]);
    var metricFields = Object.keys(md.reduce(function (acc, series) { return (__assign(__assign({}, acc), series.metric)); }, {}))
        .sort()
        .map(function (label) {
        // Labels have string field type, otherwise table tries to figure out the type which can result in unexpected results
        // Only "le" label has a number field type
        var numberField = label === 'le';
        return {
            name: label,
            config: { filterable: true },
            type: numberField ? FieldType.number : FieldType.string,
            values: new ArrayVector(),
        };
    });
    var valueField = getValueField({ data: [], valueName: valueText });
    md.forEach(function (d) {
        if (isMatrixData(d)) {
            d.values.forEach(function (val) {
                timeField.values.add(val[0] * 1000);
                metricFields.forEach(function (metricField) { return metricField.values.add(getLabelValue(d.metric, metricField.name)); });
                valueField.values.add(parseSampleValue(val[1]));
            });
        }
        else {
            timeField.values.add(d.value[0] * 1000);
            metricFields.forEach(function (metricField) { return metricField.values.add(getLabelValue(d.metric, metricField.name)); });
            valueField.values.add(parseSampleValue(d.value[1]));
        }
    });
    return {
        meta: options.meta,
        refId: options.refId,
        length: timeField.values.length,
        fields: __spreadArray(__spreadArray([timeField], __read(metricFields), false), [valueField], false),
    };
}
function getLabelValue(metric, label) {
    if (metric.hasOwnProperty(label)) {
        if (label === 'le') {
            return parseSampleValue(metric[label]);
        }
        return metric[label];
    }
    return '';
}
function getTimeField(data, isMs) {
    if (isMs === void 0) { isMs = false; }
    return {
        name: TIME_SERIES_TIME_FIELD_NAME,
        type: FieldType.time,
        config: {},
        values: new ArrayVector(data.map(function (val) { return (isMs ? val[0] : val[0] * 1000); })),
    };
}
function getValueField(_a) {
    var data = _a.data, _b = _a.valueName, valueName = _b === void 0 ? TIME_SERIES_VALUE_FIELD_NAME : _b, _c = _a.parseValue, parseValue = _c === void 0 ? true : _c, labels = _a.labels, displayNameFromDS = _a.displayNameFromDS;
    return {
        name: valueName,
        type: FieldType.number,
        display: getDisplayProcessor(),
        config: {
            displayNameFromDS: displayNameFromDS,
        },
        labels: labels,
        values: new ArrayVector(data.map(function (val) { return (parseValue ? parseSampleValue(val[1]) : val[1]); })),
    };
}
function createLabelInfo(labels, options) {
    if (options === null || options === void 0 ? void 0 : options.legendFormat) {
        var title_1 = renderTemplate(getTemplateSrv().replace(options.legendFormat, options === null || options === void 0 ? void 0 : options.scopedVars), labels);
        return { name: title_1, labels: labels };
    }
    var __name__ = labels.__name__, labelsWithoutName = __rest(labels, ["__name__"]);
    var labelPart = formatLabels(labelsWithoutName);
    var title = "" + (__name__ !== null && __name__ !== void 0 ? __name__ : '') + labelPart;
    if (!title) {
        title = options.query;
    }
    return { name: title, labels: labelsWithoutName };
}
export function getOriginalMetricName(labelData) {
    var metricName = labelData.__name__ || '';
    delete labelData.__name__;
    var labelPart = Object.entries(labelData)
        .map(function (label) { return label[0] + "=\"" + label[1] + "\""; })
        .join(',');
    return metricName + "{" + labelPart + "}";
}
export function renderTemplate(aliasPattern, aliasData) {
    var aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
    return aliasPattern.replace(aliasRegex, function (_match, g1) {
        if (aliasData[g1]) {
            return aliasData[g1];
        }
        return '';
    });
}
function transformToHistogramOverTime(seriesList) {
    /*      t1 = timestamp1, t2 = timestamp2 etc.
              t1  t2  t3          t1  t2  t3
      le10    10  10  0     =>    10  10  0
      le20    20  10  30    =>    10  0   30
      le30    30  10  35    =>    10  0   5
      */
    for (var i = seriesList.length - 1; i > 0; i--) {
        var topSeries = seriesList[i].fields.find(function (s) { return s.name === TIME_SERIES_VALUE_FIELD_NAME; });
        var bottomSeries = seriesList[i - 1].fields.find(function (s) { return s.name === TIME_SERIES_VALUE_FIELD_NAME; });
        if (!topSeries || !bottomSeries) {
            throw new Error('Prometheus heatmap transform error: data should be a time series');
        }
        for (var j = 0; j < topSeries.values.length; j++) {
            var bottomPoint = bottomSeries.values.get(j) || [0];
            topSeries.values.toArray()[j] -= bottomPoint;
        }
    }
    return seriesList;
}
function sortSeriesByLabel(s1, s2) {
    var _a, _b;
    var le1, le2;
    try {
        // fail if not integer. might happen with bad queries
        le1 = parseSampleValue((_a = s1.name) !== null && _a !== void 0 ? _a : '');
        le2 = parseSampleValue((_b = s2.name) !== null && _b !== void 0 ? _b : '');
    }
    catch (err) {
        console.error(err);
        return 0;
    }
    if (le1 > le2) {
        return 1;
    }
    if (le1 < le2) {
        return -1;
    }
    return 0;
}
function parseSampleValue(value) {
    switch (value) {
        case POSITIVE_INFINITY_SAMPLE_VALUE:
            return Number.POSITIVE_INFINITY;
        case NEGATIVE_INFINITY_SAMPLE_VALUE:
            return Number.NEGATIVE_INFINITY;
        default:
            return parseFloat(value);
    }
}
//# sourceMappingURL=result_transformer.js.map