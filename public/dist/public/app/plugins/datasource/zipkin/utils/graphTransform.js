import { NodeGraphDataFrameFieldNames as Fields } from '@grafana/data';
import { getNonOverlappingDuration, getStats, makeFrames, makeSpanMap } from '../../../../core/utils/tracing';
export function createGraphFrames(data) {
    const { nodes, edges } = convertTraceToGraph(data);
    const [nodesFrame, edgesFrame] = makeFrames();
    for (const node of nodes) {
        nodesFrame.add(node);
    }
    for (const edge of edges) {
        edgesFrame.add(edge);
    }
    return [nodesFrame, edgesFrame];
}
function convertTraceToGraph(spans) {
    var _a, _b;
    const nodes = [];
    const edges = [];
    const traceDuration = findTraceDuration(spans);
    const spanMap = makeSpanMap((index) => {
        if (index >= spans.length) {
            return undefined;
        }
        return {
            span: spans[index],
            id: spans[index].id,
            parentIds: spans[index].parentId ? [spans[index].parentId] : [],
        };
    });
    for (const span of spans) {
        const ranges = spanMap[span.id].children.map((c) => {
            const span = spanMap[c].span;
            return [span.timestamp, span.timestamp + span.duration];
        });
        const childrenDuration = getNonOverlappingDuration(ranges);
        const selfDuration = span.duration - childrenDuration;
        const stats = getStats(span.duration / 1000, traceDuration / 1000, selfDuration / 1000);
        nodes.push({
            [Fields.id]: span.id,
            [Fields.title]: ((_a = span.localEndpoint) === null || _a === void 0 ? void 0 : _a.serviceName) || ((_b = span.remoteEndpoint) === null || _b === void 0 ? void 0 : _b.serviceName) || 'unknown',
            [Fields.subTitle]: span.name,
            [Fields.mainStat]: stats.main,
            [Fields.secondaryStat]: stats.secondary,
            [Fields.color]: selfDuration / traceDuration,
        });
        if (span.parentId && spanMap[span.parentId].span) {
            edges.push({
                [Fields.id]: span.parentId + '--' + span.id,
                [Fields.target]: span.id,
                [Fields.source]: span.parentId,
            });
        }
    }
    return { nodes, edges };
}
/**
 * Get the duration of the whole trace as it isn't a part of the response data.
 * Note: Seems like this should be the same as just longest span, but this is probably safer.
 */
function findTraceDuration(spans) {
    let traceEndTime = 0;
    let traceStartTime = Infinity;
    for (const span of spans) {
        if (span.timestamp < traceStartTime) {
            traceStartTime = span.timestamp;
        }
        if (span.timestamp + span.duration > traceEndTime) {
            traceEndTime = span.timestamp + span.duration;
        }
    }
    return traceEndTime - traceStartTime;
}
//# sourceMappingURL=graphTransform.js.map