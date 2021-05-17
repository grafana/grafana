import { DataFrame, FieldType, MutableDataFrame, NodeGraphDataFrameFieldNames as Fields } from '@grafana/data';
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

  const nodesFrame = new MutableDataFrame({
    fields: [
      { name: Fields.id, type: FieldType.string },
      { name: Fields.title, type: FieldType.string },
      { name: Fields.subTitle, type: FieldType.string },
      { name: Fields.mainStat, type: FieldType.string, config: { displayName: 'Total time (% of trace)' } },
      { name: Fields.secondaryStat, type: FieldType.string, config: { displayName: 'Self time (% of total)' } },
      {
        name: Fields.color,
        type: FieldType.number,
        config: { color: { mode: 'continuous-GrYlRd' }, displayName: 'Self time / Trace duration' },
      },
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

function convertTraceToGraph(data: TraceResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const traceDuration = findTraceDuration(data.spans);
  const spanMap = makeSpanMap(data.spans);

  for (const span of data.spans) {
    const process = data.processes[span.processID];
    const childrenDuration = getDuration(spanMap[span.spanID].children.map((c) => spanMap[c].span));
    const selfDuration = span.duration - childrenDuration;

    nodes.push({
      [Fields.id]: span.spanID,
      [Fields.title]: process?.serviceName ?? '',
      [Fields.subTitle]: span.operationName,
      [Fields.mainStat]: `${toFixedNoTrailingZeros(span.duration / 1000)}ms (${toFixedNoTrailingZeros(
        (span.duration / traceDuration) * 100
      )}%)`,
      [Fields.secondaryStat]: `${toFixedNoTrailingZeros(selfDuration / 1000)}ms (${toFixedNoTrailingZeros(
        (selfDuration / span.duration) * 100
      )}%)`,
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

function toFixedNoTrailingZeros(n: number) {
  return parseFloat(n.toFixed(2));
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

/**
 * Returns a map of the spans with children array for easier processing. It will also contain empty spans in case
 * span is missing but other spans are it's children.
 */
function makeSpanMap(spans: Span[]): { [id: string]: { span: Span; children: string[] } } {
  const spanMap: { [id: string]: { span?: Span; children: string[] } } = {};

  for (const span of spans) {
    if (!spanMap[span.spanID]) {
      spanMap[span.spanID] = {
        span,
        children: [],
      };
    } else {
      spanMap[span.spanID].span = span;
    }
    for (const parent of span.references?.filter((r) => r.refType === 'CHILD_OF').map((r) => r.spanID) || []) {
      if (!spanMap[parent]) {
        spanMap[parent] = {
          span: undefined,
          children: [span.spanID],
        };
      } else {
        spanMap[parent].children.push(span.spanID);
      }
    }
  }
  return spanMap as { [id: string]: { span: Span; children: string[] } };
}

/**
 * Get non overlapping duration of the spans.
 */
function getDuration(spans: Span[]): number {
  const ranges = spans.map<[number, number]>((span) => [span.startTime, span.startTime + span.duration]);
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
