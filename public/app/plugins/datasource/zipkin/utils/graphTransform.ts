import { DataFrame, FieldType, MutableDataFrame, NodeGraphDataFrameFieldNames as Fields } from '@grafana/data';
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

  const nodesFrame = new MutableDataFrame({
    fields: [
      { name: Fields.id, type: FieldType.string },
      { name: Fields.title, type: FieldType.string },
      { name: Fields.subTitle, type: FieldType.string },
      { name: Fields.mainStat, type: FieldType.string, config: { displayName: 'Total time (% of trace)' } },
      { name: Fields.secondaryStat, type: FieldType.string, config: { displayName: 'Self time (% of total)' } },
      { name: Fields.color, type: FieldType.number, config: { color: { mode: 'continuous-GrYlRd' } } },
    ],
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
  });

  for (const node of nodes) {
    nodesFrame.add(node);
  }

  const edgesFrame = new MutableDataFrame({
    fields: [
      { name: Fields.id, type: FieldType.string },
      { name: Fields.target, type: FieldType.string },
      { name: Fields.source, type: FieldType.string },
    ],
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
  });

  for (const edge of edges) {
    edgesFrame.add(edge);
  }

  return [nodesFrame, edgesFrame];
}

function convertTraceToGraph(spans: ZipkinSpan[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const traceDuration = findTraceDuration(spans);
  const spanMap = makeSpanMap(spans);

  for (const span of spans) {
    const childrenDuration = getDuration(spanMap[span.id].children.map((c) => spanMap[c].span));
    const selfDuration = span.duration - childrenDuration;

    nodes.push({
      [Fields.id]: span.id,
      [Fields.title]: span.localEndpoint?.serviceName || span.remoteEndpoint?.serviceName || 'unknown',
      [Fields.subTitle]: span.name,
      [Fields.mainStat]: `${toFixedNoTrailingZeros(span.duration / 1000)}ms (${toFixedNoTrailingZeros(
        (span.duration / traceDuration) * 100
      )}%)`,
      [Fields.secondaryStat]: `${toFixedNoTrailingZeros(selfDuration / 1000)}ms (${toFixedNoTrailingZeros(
        (selfDuration / span.duration) * 100
      )}%)`,
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

function toFixedNoTrailingZeros(n: number) {
  return parseFloat(n.toFixed(2));
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

/**
 * Returns a map of the spans with children array for easier processing.
 */
function makeSpanMap(spans: ZipkinSpan[]): { [id: string]: { span: ZipkinSpan; children: string[] } } {
  const spanMap: { [id: string]: { span?: ZipkinSpan; children: string[] } } = {};

  for (const span of spans) {
    if (!spanMap[span.id]) {
      spanMap[span.id] = {
        span,
        children: [],
      };
    } else {
      spanMap[span.id].span = span;
    }
    if (span.parentId) {
      if (!spanMap[span.parentId]) {
        spanMap[span.parentId] = {
          span: undefined,
          children: [span.id],
        };
      } else {
        spanMap[span.parentId].children.push(span.id);
      }
    }
  }
  return spanMap as { [id: string]: { span: ZipkinSpan; children: string[] } };
}

/**
 * Get non overlapping duration of the spans.
 */
function getDuration(spans: ZipkinSpan[]): number {
  const ranges = spans.map<[number, number]>((s) => [s.timestamp, s.timestamp + s.duration]);
  ranges.sort((a, b) => a[0] - b[0]);
  const mergedRanges = ranges.reduce((acc, range) => {
    if (!acc.length) {
      return [range];
    }
    const tail = acc.slice(-1)[0];
    const [prevStart, prevEnd] = tail;
    const [start, end] = range;
    if (end < prevEnd) {
      // In this case the range is completely inside the prev range so we can just ignore it.
      return acc;
    }

    if (start > prevEnd) {
      // There is no overlap so we can just add it to stack
      return [...acc, range];
    }

    // We know there is overlap and current range ends later than previous so we can just extend the range
    return [...acc.slice(0, -1), [prevStart, end]] as Array<[number, number]>;
  }, [] as Array<[number, number]>);

  return mergedRanges.reduce((acc, range) => {
    return acc + (range[1] - range[0]);
  }, 0);
}
