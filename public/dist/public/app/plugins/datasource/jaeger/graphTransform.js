import { NodeGraphDataFrameFieldNames as Fields } from '@grafana/data';
import { getNonOverlappingDuration, getStats, makeFrames, makeSpanMap } from '../../../core/utils/tracing';
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
function convertTraceToGraph(data) {
    var _a, _b, _c;
    const nodes = [];
    const edges = [];
    const traceDuration = findTraceDuration(data.spans);
    const spanMap = makeSpanMap((index) => {
        var _a;
        if (index >= data.spans.length) {
            return undefined;
        }
        const span = data.spans[index];
        return {
            span,
            id: span.spanID,
            parentIds: ((_a = span.references) === null || _a === void 0 ? void 0 : _a.filter((r) => r.refType === 'CHILD_OF').map((r) => r.spanID)) || [],
        };
    });
    for (const span of data.spans) {
        const process = data.processes[span.processID];
        const ranges = spanMap[span.spanID].children.map((c) => {
            const span = spanMap[c].span;
            return [span.startTime, span.startTime + span.duration];
        });
        const childrenDuration = getNonOverlappingDuration(ranges);
        const selfDuration = span.duration - childrenDuration;
        const stats = getStats(span.duration / 1000, traceDuration / 1000, selfDuration / 1000);
        nodes.push({
            [Fields.id]: span.spanID,
            [Fields.title]: (_a = process === null || process === void 0 ? void 0 : process.serviceName) !== null && _a !== void 0 ? _a : '',
            [Fields.subTitle]: span.operationName,
            [Fields.mainStat]: stats.main,
            [Fields.secondaryStat]: stats.secondary,
            [Fields.color]: selfDuration / traceDuration,
        });
        const parentSpanID = (_c = (_b = span.references) === null || _b === void 0 ? void 0 : _b.find((r) => r.refType === 'CHILD_OF')) === null || _c === void 0 ? void 0 : _c.spanID;
        // Sometimes some span can be missing. Don't add edges for those.
        if (parentSpanID && spanMap[parentSpanID].span) {
            edges.push({
                [Fields.id]: parentSpanID + '--' + span.spanID,
                [Fields.target]: span.spanID,
                [Fields.source]: parentSpanID,
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
        if (span.startTime < traceStartTime) {
            traceStartTime = span.startTime;
        }
        if (span.startTime + span.duration > traceEndTime) {
            traceEndTime = span.startTime + span.duration;
        }
    }
    return traceEndTime - traceStartTime;
}
//# sourceMappingURL=graphTransform.js.map