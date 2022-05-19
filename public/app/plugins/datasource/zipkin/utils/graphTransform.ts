import { DataFrame, NodeGraphDataFrameFieldNames as Fields } from '@grafana/data';

import { getNonOverlappingDuration, getStats, makeFrames, makeSpanMap } from '../../../../core/utils/tracing';
import { ZipkinSpan } from '../types';

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

export function createGraphFrames(data: ZipkinSpan[]): DataFrame[] {
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

function convertTraceToGraph(spans: ZipkinSpan[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const traceDuration = findTraceDuration(spans);
  const spanMap = makeSpanMap((index) => {
    if (index >= spans.length) {
      return undefined;
    }
    return {
      span: spans[index],
      id: spans[index].id,
      parentIds: spans[index].parentId ? [spans[index].parentId!] : [],
    };
  });

  for (const span of spans) {
    const ranges: Array<[number, number]> = spanMap[span.id].children.map((c) => {
      const span = spanMap[c].span;
      return [span.timestamp, span.timestamp + span.duration];
    });
    const childrenDuration = getNonOverlappingDuration(ranges);
    const selfDuration = span.duration - childrenDuration;
    const stats = getStats(span.duration / 1000, traceDuration / 1000, selfDuration / 1000);

    nodes.push({
      [Fields.id]: span.id,
      [Fields.title]: span.localEndpoint?.serviceName || span.remoteEndpoint?.serviceName || 'unknown',
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
function findTraceDuration(spans: ZipkinSpan[]): number {
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
