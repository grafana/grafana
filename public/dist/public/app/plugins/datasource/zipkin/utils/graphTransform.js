import { __read, __values } from "tslib";
import { NodeGraphDataFrameFieldNames as Fields } from '@grafana/data';
import { getNonOverlappingDuration, getStats, makeFrames, makeSpanMap } from '../../../../core/utils/tracing';
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
function convertTraceToGraph(spans) {
    var e_3, _a, _b, _c;
    var _d, _e;
    var nodes = [];
    var edges = [];
    var traceDuration = findTraceDuration(spans);
    var spanMap = makeSpanMap(function (index) {
        if (index >= spans.length) {
            return undefined;
        }
        return {
            span: spans[index],
            id: spans[index].id,
            parentIds: spans[index].parentId ? [spans[index].parentId] : [],
        };
    });
    try {
        for (var spans_1 = __values(spans), spans_1_1 = spans_1.next(); !spans_1_1.done; spans_1_1 = spans_1.next()) {
            var span = spans_1_1.value;
            var ranges = spanMap[span.id].children.map(function (c) {
                var span = spanMap[c].span;
                return [span.timestamp, span.timestamp + span.duration];
            });
            var childrenDuration = getNonOverlappingDuration(ranges);
            var selfDuration = span.duration - childrenDuration;
            var stats = getStats(span.duration / 1000, traceDuration / 1000, selfDuration / 1000);
            nodes.push((_b = {},
                _b[Fields.id] = span.id,
                _b[Fields.title] = ((_d = span.localEndpoint) === null || _d === void 0 ? void 0 : _d.serviceName) || ((_e = span.remoteEndpoint) === null || _e === void 0 ? void 0 : _e.serviceName) || 'unknown',
                _b[Fields.subTitle] = span.name,
                _b[Fields.mainStat] = stats.main,
                _b[Fields.secondaryStat] = stats.secondary,
                _b[Fields.color] = selfDuration / traceDuration,
                _b));
            if (span.parentId && spanMap[span.parentId].span) {
                edges.push((_c = {},
                    _c[Fields.id] = span.parentId + '--' + span.id,
                    _c[Fields.target] = span.id,
                    _c[Fields.source] = span.parentId,
                    _c));
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (spans_1_1 && !spans_1_1.done && (_a = spans_1.return)) _a.call(spans_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return { nodes: nodes, edges: edges };
}
/**
 * Get the duration of the whole trace as it isn't a part of the response data.
 * Note: Seems like this should be the same as just longest span, but this is probably safer.
 */
function findTraceDuration(spans) {
    var e_4, _a;
    var traceEndTime = 0;
    var traceStartTime = Infinity;
    try {
        for (var spans_2 = __values(spans), spans_2_1 = spans_2.next(); !spans_2_1.done; spans_2_1 = spans_2.next()) {
            var span = spans_2_1.value;
            if (span.timestamp < traceStartTime) {
                traceStartTime = span.timestamp;
            }
            if (span.timestamp + span.duration > traceEndTime) {
                traceEndTime = span.timestamp + span.duration;
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (spans_2_1 && !spans_2_1.done && (_a = spans_2.return)) _a.call(spans_2);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return traceEndTime - traceStartTime;
}
//# sourceMappingURL=graphTransform.js.map