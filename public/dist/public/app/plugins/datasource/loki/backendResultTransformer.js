import { __rest } from "tslib";
import { isDataFrame, FieldType } from '@grafana/data';
import { getDerivedFields } from './getDerivedFields';
import { makeTableFrames } from './makeTableFrames';
import { formatQuery, getHighlighterExpressionsFromQuery } from './queryUtils';
import { dataFrameHasLokiError } from './responseUtils';
import { LokiQueryType } from './types';
function isMetricFrame(frame) {
    return frame.fields.every((field) => field.type === FieldType.time || field.type === FieldType.number);
}
// returns a new frame, with meta shallow merged with its original meta
function setFrameMeta(frame, meta) {
    const { meta: oldMeta } = frame, rest = __rest(frame, ["meta"]);
    // meta maybe be undefined, we need to handle that
    const newMeta = Object.assign(Object.assign({}, oldMeta), meta);
    return Object.assign(Object.assign({}, rest), { meta: newMeta });
}
function processStreamFrame(frame, query, derivedFieldConfigs) {
    var _a;
    const custom = Object.assign(Object.assign({}, (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.custom), { 
        // used by logsModel
        lokiQueryStatKey: 'Summary: total bytes processed' });
    if (dataFrameHasLokiError(frame)) {
        custom.error = 'Error when parsing some of the logs';
    }
    const meta = {
        preferredVisualisationType: 'logs',
        limit: query === null || query === void 0 ? void 0 : query.maxLines,
        searchWords: query !== undefined ? getHighlighterExpressionsFromQuery(formatQuery(query.expr)) : undefined,
        custom,
    };
    const newFrame = setFrameMeta(frame, meta);
    const derivedFields = getDerivedFields(newFrame, derivedFieldConfigs);
    return Object.assign(Object.assign({}, newFrame), { fields: [...newFrame.fields, ...derivedFields] });
}
function processStreamsFrames(frames, queryMap, derivedFieldConfigs) {
    return frames.map((frame) => {
        const query = frame.refId !== undefined ? queryMap.get(frame.refId) : undefined;
        return processStreamFrame(frame, query, derivedFieldConfigs);
    });
}
function processMetricInstantFrames(frames) {
    return frames.length > 0 ? makeTableFrames(frames) : [];
}
function processMetricRangeFrames(frames) {
    const meta = { preferredVisualisationType: 'graph' };
    return frames.map((frame) => setFrameMeta(frame, meta));
}
// we split the frames into 3 groups, because we will handle
// each group slightly differently
function groupFrames(frames, queryMap) {
    const streamsFrames = [];
    const metricInstantFrames = [];
    const metricRangeFrames = [];
    frames.forEach((frame) => {
        var _a;
        if (!isMetricFrame(frame)) {
            streamsFrames.push(frame);
        }
        else {
            const isInstantFrame = frame.refId != null && ((_a = queryMap.get(frame.refId)) === null || _a === void 0 ? void 0 : _a.queryType) === LokiQueryType.Instant;
            if (isInstantFrame) {
                metricInstantFrames.push(frame);
            }
            else {
                metricRangeFrames.push(frame);
            }
        }
    });
    return { streamsFrames, metricInstantFrames, metricRangeFrames };
}
function improveError(error, queryMap) {
    // many things are optional in an error-object, we need an error-message to exist,
    // and we need to find the loki-query, based on the refId in the error-object.
    if (error === undefined) {
        return error;
    }
    const { refId, message } = error;
    if (refId === undefined || message === undefined) {
        return error;
    }
    const query = queryMap.get(refId);
    if (query === undefined) {
        return error;
    }
    if (message.includes('escape') && query.expr.includes('\\')) {
        return Object.assign(Object.assign({}, error), { message: `${message}. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://grafana.com/docs/loki/latest/logql/.` });
    }
    return error;
}
export function transformBackendResult(response, queries, derivedFieldConfigs) {
    const { data, error } = response, rest = __rest(response, ["data", "error"]);
    // in the typescript type, data is an array of basically anything.
    // we do know that they have to be dataframes, so we make a quick check,
    // this way we can be sure, and also typescript is happy.
    const dataFrames = data.map((d) => {
        if (!isDataFrame(d)) {
            throw new Error('transformation only supports dataframe responses');
        }
        return d;
    });
    const queryMap = new Map(queries.map((query) => [query.refId, query]));
    const { streamsFrames, metricInstantFrames, metricRangeFrames } = groupFrames(dataFrames, queryMap);
    return Object.assign(Object.assign({}, rest), { error: improveError(error, queryMap), data: [
            ...processMetricRangeFrames(metricRangeFrames),
            ...processMetricInstantFrames(metricInstantFrames),
            ...processStreamsFrames(streamsFrames, queryMap, derivedFieldConfigs),
        ] });
}
//# sourceMappingURL=backendResultTransformer.js.map