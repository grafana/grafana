import { __assign, __read, __values } from "tslib";
import { DataFrameView, FieldColorModeId, MutableDataFrame, NodeGraphDataFrameFieldNames as Fields, } from '@grafana/data';
import { getNonOverlappingDuration, getStats, makeFrames, makeSpanMap } from '../../../core/utils/tracing';
export function createGraphFrames(data) {
    var e_1, _a, e_2, _b;
    var _c = convertTraceToGraph(data), nodes = _c.nodes, edges = _c.edges;
    var _d = __read(makeFrames(), 2), nodesFrame = _d[0], edgesFrame = _d[1];
    try {
        for (var nodes_1 = __values(nodes), nodes_1_1 = nodes_1.next(); !nodes_1_1.done; nodes_1_1 = nodes_1.next()) {
            var node = nodes_1_1.value;
            nodesFrame.add(node);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (nodes_1_1 && !nodes_1_1.done && (_a = nodes_1.return)) _a.call(nodes_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    try {
        for (var edges_1 = __values(edges), edges_1_1 = edges_1.next(); !edges_1_1.done; edges_1_1 = edges_1.next()) {
            var edge = edges_1_1.value;
            edgesFrame.add(edge);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (edges_1_1 && !edges_1_1.done && (_b = edges_1.return)) _b.call(edges_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return [nodesFrame, edgesFrame];
}
function convertTraceToGraph(data) {
    var _a, _b;
    var _c;
    var nodes = [];
    var edges = [];
    var view = new DataFrameView(data);
    var traceDuration = findTraceDuration(view);
    var spanMap = makeSpanMap(function (index) {
        if (index >= data.length) {
            return undefined;
        }
        var span = view.get(index);
        return {
            span: __assign({}, span),
            id: span.spanID,
            parentIds: span.parentSpanID ? [span.parentSpanID] : [],
        };
    });
    for (var i = 0; i < view.length; i++) {
        var row = view.get(i);
        var ranges = spanMap[row.spanID].children.map(function (c) {
            var span = spanMap[c].span;
            return [span.startTime, span.startTime + span.duration];
        });
        var childrenDuration = getNonOverlappingDuration(ranges);
        var selfDuration = row.duration - childrenDuration;
        var stats = getStats(row.duration, traceDuration, selfDuration);
        nodes.push((_a = {},
            _a[Fields.id] = row.spanID,
            _a[Fields.title] = (_c = row.serviceName) !== null && _c !== void 0 ? _c : '',
            _a[Fields.subTitle] = row.operationName,
            _a[Fields.mainStat] = stats.main,
            _a[Fields.secondaryStat] = stats.secondary,
            _a[Fields.color] = selfDuration / traceDuration,
            _a));
        // Sometimes some span can be missing. Don't add edges for those.
        if (row.parentSpanID && spanMap[row.parentSpanID].span) {
            edges.push((_b = {},
                _b[Fields.id] = row.parentSpanID + '--' + row.spanID,
                _b[Fields.target] = row.spanID,
                _b[Fields.source] = row.parentSpanID,
                _b));
        }
    }
    return { nodes: nodes, edges: edges };
}
/**
 * Get the duration of the whole trace as it isn't a part of the response data.
 * Note: Seems like this should be the same as just longest span, but this is probably safer.
 */
function findTraceDuration(view) {
    var traceEndTime = 0;
    var traceStartTime = Infinity;
    for (var i = 0; i < view.length; i++) {
        var row = view.get(i);
        if (row.startTime < traceStartTime) {
            traceStartTime = row.startTime;
        }
        if (row.startTime + row.duration > traceEndTime) {
            traceEndTime = row.startTime + row.duration;
        }
    }
    return traceEndTime - traceStartTime;
}
var secondsMetric = 'traces_service_graph_request_server_seconds_sum';
var totalsMetric = 'traces_service_graph_request_total';
var failedMetric = 'traces_service_graph_request_failed_total';
export var serviceMapMetrics = [
    secondsMetric,
    totalsMetric,
    failedMetric,
    // We don't show histogram in node graph at the moment but we could later add that into a node context menu.
    // 'traces_service_graph_request_seconds_bucket',
    // 'traces_service_graph_request_seconds_count',
    // These are used for debugging the tempo collection so probably not useful for service map right now.
    // 'traces_service_graph_unpaired_spans_total',
    // 'traces_service_graph_untagged_spans_total',
];
/**
 * Map response from multiple prometheus metrics into a node graph data frames with nodes and edges.
 * @param responses
 * @param range
 */
export function mapPromMetricsToServiceMap(responses, range) {
    var frames = getMetricFrames(responses);
    // First just collect data from the metrics into a map with nodes and edges as keys
    var nodesMap = {};
    var edgesMap = {};
    // At this moment we don't have any error/success or other counts so we just use these 2
    collectMetricData(frames[totalsMetric], 'total', totalsMetric, nodesMap, edgesMap);
    collectMetricData(frames[secondsMetric], 'seconds', secondsMetric, nodesMap, edgesMap);
    collectMetricData(frames[failedMetric], 'failed', failedMetric, nodesMap, edgesMap);
    return convertToDataFrames(nodesMap, edgesMap, range);
}
function createServiceMapDataFrames() {
    function createDF(name, fields) {
        return new MutableDataFrame({ name: name, fields: fields, meta: { preferredVisualisationType: 'nodeGraph' } });
    }
    var nodes = createDF('Nodes', [
        { name: Fields.id },
        { name: Fields.title },
        { name: Fields.mainStat, config: { unit: 'ms/r', displayName: 'Average response time' } },
        {
            name: Fields.secondaryStat,
            config: { unit: 'r/sec', displayName: 'Requests per second' },
        },
        {
            name: Fields.arc + 'success',
            config: { displayName: 'Success', color: { fixedColor: 'green', mode: FieldColorModeId.Fixed } },
        },
        {
            name: Fields.arc + 'failed',
            config: { displayName: 'Failed', color: { fixedColor: 'red', mode: FieldColorModeId.Fixed } },
        },
    ]);
    var edges = createDF('Edges', [
        { name: Fields.id },
        { name: Fields.source },
        { name: Fields.target },
        { name: Fields.mainStat, config: { unit: 'r', displayName: 'Requests' } },
        { name: Fields.secondaryStat, config: { unit: 'ms/r', displayName: 'Average response time' } },
    ]);
    return [nodes, edges];
}
/**
 * Group frames from response based on ref id which is set the same as the metric name so we know which metric is where
 * and also put it into DataFrameView so it's easier to work with.
 * @param responses
 */
function getMetricFrames(responses) {
    return responses[0].data.reduce(function (acc, frame) {
        acc[frame.refId] = new DataFrameView(frame);
        return acc;
    }, {});
}
/**
 * Collect data from a metric into a map of nodes and edges. The metric data is modeled as counts of metric per edge
 * which is a pair of client-server nodes. This means we convert each row of the metric 1-1 to edges and than we assign
 * the metric also to server. We count the stats for server only as we show requests/transactions that particular node
 * processed not those which it generated and other stats like average transaction time then stem from that.
 * @param frame
 * @param stat
 * @param metric
 * @param nodesMap
 * @param edgesMap
 */
function collectMetricData(frame, stat, metric, nodesMap, edgesMap) {
    var _a, _b, _c;
    if (!frame) {
        return;
    }
    // The name of the value column is in this format
    // TODO figure out if it can be changed
    var valueName = "Value #" + metric;
    for (var i = 0; i < frame.length; i++) {
        var row = frame.get(i);
        var edgeId = row.client + "_" + row.server;
        if (!edgesMap[edgeId]) {
            // Create edge as it does not exist yet
            edgesMap[edgeId] = (_a = {
                    target: row.server,
                    source: row.client
                },
                _a[stat] = row[valueName],
                _a);
        }
        else {
            // Add stat to edge
            // We are adding the values if exists but that should not happen in general as there should be single row for
            // an edge.
            edgesMap[edgeId][stat] = (edgesMap[edgeId][stat] || 0) + row[valueName];
        }
        if (!nodesMap[row.server]) {
            // Create node for server
            nodesMap[row.server] = (_b = {},
                _b[stat] = row[valueName],
                _b);
        }
        else {
            // Add stat to server node. Sum up values if there are multiple edges targeting this server node.
            nodesMap[row.server][stat] = (nodesMap[row.server][stat] || 0) + row[valueName];
        }
        if (!nodesMap[row.client]) {
            // Create the client node but don't add the stat as edge stats are attributed to the server node. This means for
            // example that the number of requests in a node show how many requests it handled not how many it generated.
            nodesMap[row.client] = (_c = {},
                _c[stat] = 0,
                _c);
        }
    }
}
function convertToDataFrames(nodesMap, edgesMap, range) {
    var e_3, _a, _b, e_4, _c, _d;
    var rangeMs = range.to.valueOf() - range.from.valueOf();
    var _e = __read(createServiceMapDataFrames(), 2), nodes = _e[0], edges = _e[1];
    try {
        for (var _f = __values(Object.keys(nodesMap)), _g = _f.next(); !_g.done; _g = _f.next()) {
            var nodeId = _g.value;
            var node = nodesMap[nodeId];
            nodes.add((_b = {},
                _b[Fields.id] = nodeId,
                _b[Fields.title] = nodeId,
                // NaN will not be shown in the node graph. This happens for a root client node which did not process
                // any requests itself.
                _b[Fields.mainStat] = node.total ? (node.seconds / node.total) * 1000 : Number.NaN,
                _b[Fields.secondaryStat] = node.total ? Math.round((node.total / (rangeMs / 1000)) * 100) / 100 : Number.NaN,
                _b[Fields.arc + 'success'] = node.total ? (node.total - (node.failed || 0)) / node.total : 1,
                _b[Fields.arc + 'failed'] = node.total ? (node.failed || 0) / node.total : 0,
                _b));
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (_g && !_g.done && (_a = _f.return)) _a.call(_f);
        }
        finally { if (e_3) throw e_3.error; }
    }
    try {
        for (var _h = __values(Object.keys(edgesMap)), _j = _h.next(); !_j.done; _j = _h.next()) {
            var edgeId = _j.value;
            var edge = edgesMap[edgeId];
            edges.add((_d = {},
                _d[Fields.id] = edgeId,
                _d[Fields.source] = edge.source,
                _d[Fields.target] = edge.target,
                _d[Fields.mainStat] = edge.total,
                _d[Fields.secondaryStat] = edge.total ? (edge.seconds / edge.total) * 1000 : Number.NaN,
                _d));
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_j && !_j.done && (_c = _h.return)) _c.call(_h);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return [nodes, edges];
}
//# sourceMappingURL=graphTransform.js.map