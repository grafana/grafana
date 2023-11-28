import { __rest } from "tslib";
import { descending, deviation } from 'd3';
import { flatten, forOwn, groupBy, partition } from 'lodash';
import { ArrayDataFrame, CoreApp, DataFrameType, DataTopic, FieldType, formatLabels, getDisplayProcessor, getFieldDisplayName, renderLegendFormat, TIME_SERIES_TIME_FIELD_NAME, TIME_SERIES_VALUE_FIELD_NAME, } from '@grafana/data';
import { config, getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
import { isExemplarData, isMatrixData, } from './types';
// handles case-insensitive Inf, +Inf, -Inf (with optional "inity" suffix)
const INFINITY_SAMPLE_REGEX = /^[+-]?inf(?:inity)?$/i;
const isTableResult = (dataFrame, options) => {
    var _a, _b, _c, _d;
    // We want to process vector and scalar results in Explore as table
    if (options.app === CoreApp.Explore &&
        (((_b = (_a = dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.resultType) === 'vector' || ((_d = (_c = dataFrame.meta) === null || _c === void 0 ? void 0 : _c.custom) === null || _d === void 0 ? void 0 : _d.resultType) === 'scalar')) {
        return true;
    }
    // We want to process all dataFrames with target.format === 'table' as table
    const target = options.targets.find((target) => target.refId === dataFrame.refId);
    return (target === null || target === void 0 ? void 0 : target.format) === 'table';
};
const isHeatmapResult = (dataFrame, options) => {
    const target = options.targets.find((target) => target.refId === dataFrame.refId);
    return (target === null || target === void 0 ? void 0 : target.format) === 'heatmap';
};
// V2 result transformer used to transform query results from queries that were run through prometheus backend
export function transformV2(response, request, options) {
    // migration for dataplane field name issue
    if (config.featureToggles.prometheusDataplane) {
        // update displayNameFromDS in the field config
        response.data.forEach((f) => {
            const target = request.targets.find((t) => t.refId === f.refId);
            // check that the legend is selected as auto
            if (target && target.legendFormat === '__auto') {
                f.fields.forEach((field) => {
                    var _a, _b;
                    if (((_a = field.labels) === null || _a === void 0 ? void 0 : _a.__name__) && ((_b = field.labels) === null || _b === void 0 ? void 0 : _b.__name__) === field.name) {
                        const fieldCopy = Object.assign(Object.assign({}, field), { name: TIME_SERIES_VALUE_FIELD_NAME });
                        field.config.displayNameFromDS = getFieldDisplayName(fieldCopy, f, response.data);
                    }
                });
            }
        });
    }
    const [tableFrames, framesWithoutTable] = partition(response.data, (df) => isTableResult(df, request));
    const processedTableFrames = transformDFToTable(tableFrames);
    const [exemplarFrames, framesWithoutTableAndExemplars] = partition(framesWithoutTable, (df) => { var _a, _b; return ((_b = (_a = df.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.resultType) === 'exemplar'; });
    // EXEMPLAR FRAMES: We enrich exemplar frames with data links and add dataTopic meta info
    const { exemplarTraceIdDestinations: destinations } = options;
    const processedExemplarFrames = exemplarFrames.map((dataFrame) => {
        var _a;
        if (destinations === null || destinations === void 0 ? void 0 : destinations.length) {
            for (const exemplarTraceIdDestination of destinations) {
                const traceIDField = dataFrame.fields.find((field) => field.name === exemplarTraceIdDestination.name);
                if (traceIDField) {
                    const links = getDataLinks(exemplarTraceIdDestination);
                    traceIDField.config.links = ((_a = traceIDField.config.links) === null || _a === void 0 ? void 0 : _a.length)
                        ? [...traceIDField.config.links, ...links]
                        : links;
                }
            }
        }
        return Object.assign(Object.assign({}, dataFrame), { meta: Object.assign(Object.assign({}, dataFrame.meta), { dataTopic: DataTopic.Annotations }) });
    });
    const [heatmapResults, framesWithoutTableHeatmapsAndExemplars] = partition(framesWithoutTableAndExemplars, (df) => isHeatmapResult(df, request));
    // this works around the fact that we only get back frame.name with le buckets when legendFormat == {{le}}...which is not the default
    heatmapResults.forEach((df) => {
        var _a;
        if (df.name == null) {
            let f = df.fields.find((f) => f.type === FieldType.number);
            if (f) {
                let le = (_a = f.labels) === null || _a === void 0 ? void 0 : _a.le;
                if (le) {
                    // this is used for sorting the frames by numeric ascending le labels for de-accum
                    df.name = le;
                    // this is used for renaming the Value fields to le label
                    f.config.displayNameFromDS = le;
                }
            }
        }
    });
    // Group heatmaps by query
    const heatmapResultsGroupedByQuery = groupBy(heatmapResults, (h) => h.refId);
    // Initialize empty array to push grouped histogram frames to
    let processedHeatmapResultsGroupedByQuery = [];
    // Iterate through every query in this heatmap
    for (const query in heatmapResultsGroupedByQuery) {
        // Get reference to dataFrames for heatmap
        const heatmapResultsGroup = heatmapResultsGroupedByQuery[query];
        // Create a new grouping by iterating through the data frames...
        const heatmapResultsGroupedByValues = groupBy(heatmapResultsGroup, (dataFrame) => {
            var _a;
            // Each data frame has `Time` and `Value` properties, we want to get the values
            const values = dataFrame.fields.find((field) => field.type === FieldType.number);
            // Specific functionality for special "le" quantile heatmap value, we know if this value exists, that we do not want to calculate the heatmap density across data frames from the same quartile
            if ((values === null || values === void 0 ? void 0 : values.labels) && HISTOGRAM_QUANTILE_LABEL_NAME in values.labels) {
                const _b = values === null || values === void 0 ? void 0 : values.labels, { le } = _b, notLE = __rest(_b, ["le"]);
                return Object.values(notLE).join();
            }
            // Return a string made from the concatenation of this frame's values to represent a grouping in the query
            return Object.values((_a = values === null || values === void 0 ? void 0 : values.labels) !== null && _a !== void 0 ? _a : []).join();
        });
        // Then iterate through the resultant object
        forOwn(heatmapResultsGroupedByValues, (dataFrames, key) => {
            // Sort frames within each grouping
            const sortedHeatmap = dataFrames.sort(sortSeriesByLabel);
            // And push the sorted grouping with the rest
            processedHeatmapResultsGroupedByQuery.push(mergeHeatmapFrames(transformToHistogramOverTime(sortedHeatmap)));
        });
    }
    // Everything else is processed as time_series result and graph preferredVisualisationType
    const otherFrames = framesWithoutTableHeatmapsAndExemplars.map((dataFrame) => {
        const df = Object.assign(Object.assign({}, dataFrame), { meta: Object.assign(Object.assign({}, dataFrame.meta), { preferredVisualisationType: 'graph' }) });
        return df;
    });
    const flattenedProcessedHeatmapFrames = flatten(processedHeatmapResultsGroupedByQuery);
    return Object.assign(Object.assign({}, response), { data: [...otherFrames, ...processedTableFrames, ...flattenedProcessedHeatmapFrames, ...processedExemplarFrames] });
}
const HISTOGRAM_QUANTILE_LABEL_NAME = 'le';
export function transformDFToTable(dfs) {
    // If no dataFrames or if 1 dataFrames with no values, return original dataFrame
    if (dfs.length === 0 || (dfs.length === 1 && dfs[0].length === 0)) {
        return dfs;
    }
    // Group results by refId and process dataFrames with the same refId as 1 dataFrame
    const dataFramesByRefId = groupBy(dfs, 'refId');
    const refIds = Object.keys(dataFramesByRefId);
    const frames = refIds.map((refId) => {
        // Create timeField, valueField and labelFields
        const valueText = getValueText(refIds.length, refId);
        const valueField = getValueField({ data: [], valueName: valueText });
        const timeField = getTimeField([]);
        const labelFields = [];
        // Fill labelsFields with labels from dataFrames
        dataFramesByRefId[refId].forEach((df) => {
            var _a;
            const frameValueField = df.fields[1];
            const promLabels = (_a = frameValueField === null || frameValueField === void 0 ? void 0 : frameValueField.labels) !== null && _a !== void 0 ? _a : {};
            Object.keys(promLabels)
                .sort()
                .forEach((label) => {
                // If we don't have label in labelFields, add it
                if (!labelFields.some((l) => l.name === label)) {
                    const numberField = label === HISTOGRAM_QUANTILE_LABEL_NAME;
                    labelFields.push({
                        name: label,
                        config: { filterable: true },
                        type: numberField ? FieldType.number : FieldType.string,
                        values: [],
                    });
                }
            });
        });
        // Fill valueField, timeField and labelFields with values
        dataFramesByRefId[refId].forEach((df) => {
            var _a, _b, _c, _d;
            const timeFields = (_b = (_a = df.fields[0]) === null || _a === void 0 ? void 0 : _a.values) !== null && _b !== void 0 ? _b : [];
            const dataFields = (_d = (_c = df.fields[1]) === null || _c === void 0 ? void 0 : _c.values) !== null && _d !== void 0 ? _d : [];
            timeFields.forEach((value) => timeField.values.push(value));
            dataFields.forEach((value) => {
                var _a;
                valueField.values.push(parseSampleValue(value));
                const labelsForField = (_a = df.fields[1].labels) !== null && _a !== void 0 ? _a : {};
                labelFields.forEach((field) => field.values.push(getLabelValue(labelsForField, field.name)));
            });
        });
        const fields = [timeField, ...labelFields, valueField];
        return {
            refId,
            fields,
            // Prometheus specific UI for instant queries
            meta: Object.assign(Object.assign({}, dataFramesByRefId[refId][0].meta), { preferredVisualisationType: 'rawPrometheus' }),
            length: timeField.values.length,
        };
    });
    return frames;
}
function getValueText(responseLength, refId = '') {
    return responseLength > 1 ? `Value #${refId}` : 'Value';
}
export function transform(response, transformOptions) {
    var _a, _b;
    // Create options object from transformOptions
    const options = {
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
            preferredVisualisationType: transformOptions.query.instant ? 'rawPrometheus' : 'graph',
        },
    };
    const prometheusResult = response.data.data;
    if (isExemplarData(prometheusResult)) {
        const events = [];
        prometheusResult.forEach((exemplarData) => {
            const data = exemplarData.exemplars.map((exemplar) => {
                return Object.assign(Object.assign({ [TIME_SERIES_TIME_FIELD_NAME]: exemplar.timestamp * 1000, [TIME_SERIES_VALUE_FIELD_NAME]: exemplar.value }, exemplar.labels), exemplarData.seriesLabels);
            });
            events.push(...data);
        });
        // Grouping exemplars by step
        const sampledExemplars = sampleExemplars(events, options);
        const dataFrame = new ArrayDataFrame(sampledExemplars);
        dataFrame.meta = { dataTopic: DataTopic.Annotations };
        // Add data links if configured
        if ((_a = transformOptions.exemplarTraceIdDestinations) === null || _a === void 0 ? void 0 : _a.length) {
            for (const exemplarTraceIdDestination of transformOptions.exemplarTraceIdDestinations) {
                const traceIDField = dataFrame.fields.find((field) => field.name === exemplarTraceIdDestination.name);
                if (traceIDField) {
                    const links = getDataLinks(exemplarTraceIdDestination);
                    traceIDField.config.links = ((_b = traceIDField.config.links) === null || _b === void 0 ? void 0 : _b.length)
                        ? [...traceIDField.config.links, ...links]
                        : links;
                }
            }
        }
        return [dataFrame];
    }
    if (!(prometheusResult === null || prometheusResult === void 0 ? void 0 : prometheusResult.result)) {
        return [];
    }
    // Return early if result type is scalar
    if (prometheusResult.resultType === 'scalar') {
        const df = {
            meta: options.meta,
            refId: options.refId,
            length: 1,
            fields: [getTimeField([prometheusResult.result]), getValueField({ data: [prometheusResult.result] })],
        };
        return [df];
    }
    // Return early again if the format is table, this needs special transformation.
    if (options.format === 'table') {
        const tableData = transformMetricDataToTable(prometheusResult.result, options);
        return [tableData];
    }
    // Process matrix and vector results to DataFrame
    const dataFrame = [];
    prometheusResult.result.forEach((data) => dataFrame.push(transformToDataFrame(data, options)));
    // When format is heatmap use the already created data frames and transform it more
    if (options.format === 'heatmap') {
        return mergeHeatmapFrames(transformToHistogramOverTime(dataFrame.sort(sortSeriesByLabel)));
    }
    // Return matrix or vector result as DataFrame[]
    return dataFrame;
}
function getDataLinks(options) {
    var _a;
    const dataLinks = [];
    if (options.datasourceUid) {
        const dataSourceSrv = getDataSourceSrv();
        const dsSettings = dataSourceSrv.getInstanceSettings(options.datasourceUid);
        // dsSettings is undefined because of the reasons below:
        // - permissions issues (probably most likely)
        // - deleted datasource
        // - misconfiguration
        if (dsSettings) {
            dataLinks.push({
                title: options.urlDisplayLabel || `Query with ${dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.name}`,
                url: '',
                internal: {
                    query: { query: '${__value.raw}', queryType: 'traceql' },
                    datasourceUid: options.datasourceUid,
                    datasourceName: (_a = dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.name) !== null && _a !== void 0 ? _a : 'Data source not found',
                },
            });
        }
    }
    if (options.url) {
        dataLinks.push({
            title: options.urlDisplayLabel || `Go to ${options.url}`,
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
    const step = options.step || 15;
    const bucketedExemplars = {};
    const values = [];
    for (const exemplar of events) {
        // Align exemplar timestamp to nearest step second
        const alignedTs = String(Math.floor(exemplar[TIME_SERIES_TIME_FIELD_NAME] / 1000 / step) * step * 1000);
        if (!bucketedExemplars[alignedTs]) {
            // New bucket found
            bucketedExemplars[alignedTs] = [];
        }
        bucketedExemplars[alignedTs].push(exemplar);
        values.push(exemplar[TIME_SERIES_VALUE_FIELD_NAME]);
    }
    // Getting exemplars from each bucket
    const standardDeviation = deviation(values);
    const sampledBuckets = Object.keys(bucketedExemplars).sort();
    const sampledExemplars = [];
    for (const ts of sampledBuckets) {
        const exemplarsInBucket = bucketedExemplars[ts];
        if (exemplarsInBucket.length === 1) {
            sampledExemplars.push(exemplarsInBucket[0]);
        }
        else {
            // Choose which values to sample
            const bucketValues = exemplarsInBucket.map((ex) => ex[TIME_SERIES_VALUE_FIELD_NAME]).sort(descending);
            const sampledBucketValues = bucketValues.reduce((acc, curr) => {
                if (acc.length === 0) {
                    // First value is max and is always added
                    acc.push(curr);
                }
                else {
                    // Then take values only when at least 2 standard deviation distance to previously taken value
                    const prev = acc[acc.length - 1];
                    if (standardDeviation && prev - curr >= 2 * standardDeviation) {
                        acc.push(curr);
                    }
                }
                return acc;
            }, []);
            // Find the exemplars for the sampled values
            sampledExemplars.push(...sampledBucketValues.map((value) => exemplarsInBucket.find((ex) => ex[TIME_SERIES_VALUE_FIELD_NAME] === value)));
        }
    }
    return sampledExemplars;
}
/**
 * Transforms matrix and vector result from Prometheus result to DataFrame
 */
function transformToDataFrame(data, options) {
    const { name, labels } = createLabelInfo(data.metric, options);
    const fields = [];
    if (isMatrixData(data)) {
        const stepMs = options.step ? options.step * 1000 : NaN;
        let baseTimestamp = options.start * 1000;
        const dps = [];
        for (const value of data.values) {
            let dpValue = parseSampleValue(value[1]);
            if (isNaN(dpValue)) {
                dpValue = null;
            }
            const timestamp = value[0] * 1000;
            for (let t = baseTimestamp; t < timestamp; t += stepMs) {
                dps.push([t, null]);
            }
            baseTimestamp = timestamp + stepMs;
            dps.push([timestamp, dpValue]);
        }
        const endTimestamp = options.end * 1000;
        for (let t = baseTimestamp; t <= endTimestamp; t += stepMs) {
            dps.push([t, null]);
        }
        fields.push(getTimeField(dps, true));
        fields.push(getValueField({ data: dps, parseValue: false, labels, displayNameFromDS: name }));
    }
    else {
        fields.push(getTimeField([data.value]));
        fields.push(getValueField({ data: [data.value], labels, displayNameFromDS: name }));
    }
    return {
        meta: options.meta,
        refId: options.refId,
        length: fields[0].values.length,
        fields,
        name,
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
    const valueText = options.responseListLength > 1 || options.valueWithRefId ? `Value #${options.refId}` : 'Value';
    const timeField = getTimeField([]);
    const metricFields = Object.keys(md.reduce((acc, series) => (Object.assign(Object.assign({}, acc), series.metric)), {}))
        .sort()
        .map((label) => {
        // Labels have string field type, otherwise table tries to figure out the type which can result in unexpected results
        // Only "le" label has a number field type
        const numberField = label === HISTOGRAM_QUANTILE_LABEL_NAME;
        const field = {
            name: label,
            config: { filterable: true },
            type: numberField ? FieldType.number : FieldType.string,
            values: [],
        };
        return field;
    });
    const valueField = getValueField({ data: [], valueName: valueText });
    md.forEach((d) => {
        if (isMatrixData(d)) {
            d.values.forEach((val) => {
                timeField.values.push(val[0] * 1000);
                metricFields.forEach((metricField) => metricField.values.push(getLabelValue(d.metric, metricField.name)));
                valueField.values.push(parseSampleValue(val[1]));
            });
        }
        else {
            timeField.values.push(d.value[0] * 1000);
            metricFields.forEach((metricField) => metricField.values.push(getLabelValue(d.metric, metricField.name)));
            valueField.values.push(parseSampleValue(d.value[1]));
        }
    });
    return {
        meta: options.meta,
        refId: options.refId,
        length: timeField.values.length,
        fields: [timeField, ...metricFields, valueField],
    };
}
function getLabelValue(metric, label) {
    if (metric.hasOwnProperty(label)) {
        if (label === HISTOGRAM_QUANTILE_LABEL_NAME) {
            return parseSampleValue(metric[label]);
        }
        return metric[label];
    }
    return '';
}
function getTimeField(data, isMs = false) {
    return {
        name: TIME_SERIES_TIME_FIELD_NAME,
        type: FieldType.time,
        config: {},
        values: data.map((val) => (isMs ? val[0] : val[0] * 1000)),
    };
}
function getValueField({ data, valueName = TIME_SERIES_VALUE_FIELD_NAME, parseValue = true, labels, displayNameFromDS, }) {
    return {
        name: valueName,
        type: FieldType.number,
        display: getDisplayProcessor(),
        config: {
            displayNameFromDS,
        },
        labels,
        values: data.map((val) => (parseValue ? parseSampleValue(val[1]) : val[1])),
    };
}
function createLabelInfo(labels, options) {
    if (options === null || options === void 0 ? void 0 : options.legendFormat) {
        const title = renderLegendFormat(getTemplateSrv().replace(options.legendFormat, options === null || options === void 0 ? void 0 : options.scopedVars), labels);
        return { name: title, labels };
    }
    const { __name__ } = labels, labelsWithoutName = __rest(labels, ["__name__"]);
    const labelPart = formatLabels(labelsWithoutName);
    let title = `${__name__ !== null && __name__ !== void 0 ? __name__ : ''}${labelPart}`;
    if (!title) {
        title = options.query;
    }
    return { name: title, labels: labelsWithoutName };
}
export function getOriginalMetricName(labelData) {
    const metricName = labelData.__name__ || '';
    delete labelData.__name__;
    const labelPart = Object.entries(labelData)
        .map((label) => `${label[0]}="${label[1]}"`)
        .join(',');
    return `${metricName}{${labelPart}}`;
}
function mergeHeatmapFrames(frames) {
    if (frames.length === 0 || (frames.length === 1 && frames[0].length === 0)) {
        return [];
    }
    const timeField = frames[0].fields.find((field) => field.type === FieldType.time);
    const countFields = frames.map((frame) => {
        let field = frame.fields.find((field) => field.type === FieldType.number);
        return Object.assign(Object.assign({}, field), { name: field.config.displayNameFromDS });
    });
    return [
        Object.assign(Object.assign({}, frames[0]), { meta: Object.assign(Object.assign({}, frames[0].meta), { type: DataFrameType.HeatmapRows }), fields: [timeField, ...countFields] }),
    ];
}
function transformToHistogramOverTime(seriesList) {
    /*      t1 = timestamp1, t2 = timestamp2 etc.
              t1  t2  t3          t1  t2  t3
      le10    10  10  0     =>    10  10  0
      le20    20  10  30    =>    10  0   30
      le30    30  10  35    =>    10  0   5
      */
    for (let i = seriesList.length - 1; i > 0; i--) {
        const topSeries = seriesList[i].fields.find((s) => s.type === FieldType.number);
        const bottomSeries = seriesList[i - 1].fields.find((s) => s.type === FieldType.number);
        if (!topSeries || !bottomSeries) {
            throw new Error('Prometheus heatmap transform error: data should be a time series');
        }
        for (let j = 0; j < topSeries.values.length; j++) {
            const bottomPoint = bottomSeries.values[j] || [0];
            topSeries.values[j] -= bottomPoint;
        }
    }
    return seriesList;
}
export function sortSeriesByLabel(s1, s2) {
    var _a, _b, _c, _d, _e, _f;
    let le1, le2;
    try {
        // the state.displayName conditions are here because we also use this sorting util fn
        // in panels where isHeatmapResult was false but we still want to sort numerically-named
        // fields after the full unique displayName is cached in field state
        le1 = parseSampleValue((_c = (_b = (_a = s1.fields[1].state) === null || _a === void 0 ? void 0 : _a.displayName) !== null && _b !== void 0 ? _b : s1.name) !== null && _c !== void 0 ? _c : s1.fields[1].name);
        le2 = parseSampleValue((_f = (_e = (_d = s2.fields[1].state) === null || _d === void 0 ? void 0 : _d.displayName) !== null && _e !== void 0 ? _e : s2.name) !== null && _f !== void 0 ? _f : s2.fields[1].name);
    }
    catch (err) {
        // fail if not integer. might happen with bad queries
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
/** @internal */
export function parseSampleValue(value) {
    if (INFINITY_SAMPLE_REGEX.test(value)) {
        return value[0] === '-' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    }
    return parseFloat(value);
}
//# sourceMappingURL=result_transformer.js.map