import {
  FieldType,
  NodeGraphDataFrameFieldNames as Fields,
  DataFrameView,
  DataFrame,
  MutableDataFrame,
} from '@grafana/data';

export function createNodeGraphFrames(data: DataFrame): DataFrame[] {
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

function convertTraceToGraph(data: DataFrame): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const view = new DataFrameView<TraceRow>(data);

  const traceDuration = findTraceDuration(view);
  const spanMap = makeSpanMap((index) => {
    if (index >= data.length) {
      return undefined;
    }
    const span = view.get(index);
    return {
      span: { ...span },
      id: span.spanID,
      parentIds: span.parentSpanID ? [span.parentSpanID] : [],
    };
  });

  for (let i = 0; i < view.length; i++) {
    const row = view.get(i);

    const ranges: Array<[number, number]> = spanMap[row.spanID].children.map((c) => {
      const span = spanMap[c].span;
      return [span.startTime, span.startTime + span.duration];
    });
    const childrenDuration = getNonOverlappingDuration(ranges);
    const selfDuration = row.duration - childrenDuration;
    const stats = getStats(row.duration, traceDuration, selfDuration);

    nodes.push({
      [Fields.id]: row.spanID,
      [Fields.title]: row.serviceName ?? '',
      [Fields.subTitle]: row.operationName,
      [Fields.mainStat]: stats.main,
      [Fields.secondaryStat]: stats.secondary,
      [Fields.color]: selfDuration / traceDuration,
    });

    // Sometimes some span can be missing. Don't add edges for those.
    if (row.parentSpanID && spanMap[row.parentSpanID].span) {
      edges.push({
        [Fields.id]: row.parentSpanID + '--' + row.spanID,
        [Fields.target]: row.spanID,
        [Fields.source]: row.parentSpanID,
      });
    }
  }

  return { nodes, edges };
}

/**
 * Get non overlapping duration of the ranges as they can overlap or have gaps.
 */
export function getNonOverlappingDuration(ranges: Array<[number, number]>): number {
  ranges.sort((a, b) => a[0] - b[0]);
  const mergedRanges = ranges.reduce<Array<[number, number]>>((acc, range) => {
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
    return [...acc.slice(0, -1), [prevStart, end]];
  }, []);

  return mergedRanges.reduce((acc, range) => {
    return acc + (range[1] - range[0]);
  }, 0);
}

/**
 * Returns a map of the spans with children array for easier processing. It will also contain empty spans in case
 * span is missing but other spans are its children. This is more generic because it needs to allow iterating over
 * both arrays and dataframe views.
 */
export function makeSpanMap<T>(getSpan: (index: number) => { span: T; id: string; parentIds: string[] } | undefined): {
  [id: string]: { span: T; children: string[] };
} {
  const spanMap: { [id: string]: { span?: T; children: string[] } } = {};

  let span;
  for (let index = 0; (span = getSpan(index)), !!span; index++) {
    if (!spanMap[span.id]) {
      spanMap[span.id] = {
        span: span.span,
        children: [],
      };
    } else {
      spanMap[span.id].span = span.span;
    }

    for (const parentId of span.parentIds) {
      if (parentId) {
        if (!spanMap[parentId]) {
          spanMap[parentId] = {
            span: undefined,
            children: [span.id],
          };
        } else {
          spanMap[parentId].children.push(span.id);
        }
      }
    }
  }
  // Discussion on this type assertion here: https://github.com/grafana/grafana/pull/80362/files#r1451019375
  return spanMap as { [id: string]: { span: T; children: string[] } };
}

export function getStats(duration: number, traceDuration: number, selfDuration: number) {
  return {
    main: `${toFixedNoTrailingZeros(duration)}ms (${toFixedNoTrailingZeros((duration / traceDuration) * 100)}%)`,
    secondary: `${toFixedNoTrailingZeros(selfDuration)}ms (${toFixedNoTrailingZeros(
      (selfDuration / duration) * 100
    )}%)`,
  };
}

function toFixedNoTrailingZeros(n: number) {
  return parseFloat(n.toFixed(2));
}

/**
 * Create default frames used when returning data for node graph.
 */
export function makeFrames() {
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

  return [nodesFrame, edgesFrame];
}

/**
 * Get the duration of the whole trace as it isn't a part of the response data.
 * Note: Seems like this should be the same as just longest span, but this is probably safer.
 */
function findTraceDuration(view: DataFrameView<TraceRow>): number {
  let traceEndTime = 0;
  let traceStartTime = Infinity;

  for (let i = 0; i < view.length; i++) {
    const row = view.get(i);

    if (row.startTime < traceStartTime) {
      traceStartTime = row.startTime;
    }

    if (row.startTime + row.duration > traceEndTime) {
      traceEndTime = row.startTime + row.duration;
    }
  }

  return traceEndTime - traceStartTime;
}

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

interface TraceRow {
  traceID: string;
  spanID: string;
  parentSpanID: string;
  operationName: string;
  serviceName: string;
  serviceTags: string;
  startTime: number;
  duration: number;
  logs: string;
  tags: string;
}
