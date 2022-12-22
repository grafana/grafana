import { DataFrame, NodeGraphDataFrameFieldNames as Fields } from '@grafana/data';

import { getNonOverlappingDuration, getStats, makeFrames, makeSpanMap } from '../../../core/utils/tracing';

import { Span, TraceResponse } from './types';

interface Node {
  [Fields.id]: string;
  [Fields.title]: string;
  [Fields.subTitle]: string;
  [Fields.mainStat]: string;
  [Fields.secondaryStat]: string;
  [Fields.color]: number;
}

interface Edge {
  [Fields.id]: string;
  [Fields.target]: string;
  [Fields.source]: string;
}

export function createGraphFrames(data: TraceResponse): DataFrame[] {
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

function convertTraceToGraph(data: TraceResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const traceDuration = findTraceDuration(data.spans);

  const spanMap = makeSpanMap((index) => {
    if (index >= data.spans.length) {
      return undefined;
    }
    const span = data.spans[index];
    return {
      span,
      id: span.spanID,
      parentIds: span.references?.filter((r) => r.refType === 'CHILD_OF').map((r) => r.spanID) || [],
    };
  });

  for (const span of data.spans) {
    const process = data.processes[span.processID];

    const ranges: Array<[number, number]> = spanMap[span.spanID].children.map((c) => {
      const span = spanMap[c].span;
      return [span.startTime, span.startTime + span.duration];
    });
    const childrenDuration = getNonOverlappingDuration(ranges);
    const selfDuration = span.duration - childrenDuration;
    const stats = getStats(span.duration / 1000, traceDuration / 1000, selfDuration / 1000);

    nodes.push({
      [Fields.id]: span.spanID,
      [Fields.title]: process?.serviceName ?? '',
      [Fields.subTitle]: span.operationName,
      [Fields.mainStat]: stats.main,
      [Fields.secondaryStat]: stats.secondary,
      [Fields.color]: selfDuration / traceDuration,
    });

    const parentSpanID = span.references?.find((r) => r.refType === 'CHILD_OF')?.spanID;
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
function findTraceDuration(spans: Span[]): number {
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
