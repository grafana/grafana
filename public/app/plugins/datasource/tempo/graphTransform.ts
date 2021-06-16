import {
  DataFrame,
  DataFrameView,
  FieldType,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames as Fields,
} from '@grafana/data';

interface Row {
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

export function createGraphFrames(data: DataFrame): DataFrame[] {
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

function convertTraceToGraph(data: DataFrame): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const view = new DataFrameView<Row>(data);

  const traceDuration = findTraceDuration(view);
  const spanMap = makeSpanMap(view);

  for (let i = 0; i < view.length; i++) {
    const row = view.get(i);

    const childrenDuration = getDuration(spanMap[row.spanID].children.map((c) => spanMap[c].span));
    const selfDuration = row.duration - childrenDuration;

    nodes.push({
      [Fields.id]: row.spanID,
      [Fields.title]: row.serviceName ?? '',
      [Fields.subTitle]: row.operationName,
      [Fields.mainStat]: `total: ${toFixedNoTrailingZeros(row.duration)}ms (${toFixedNoTrailingZeros(
        (row.duration / traceDuration) * 100
      )}%)`,
      [Fields.secondaryStat]: `self: ${toFixedNoTrailingZeros(selfDuration)}ms (${toFixedNoTrailingZeros(
        (selfDuration / row.duration) * 100
      )}%)`,
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

function toFixedNoTrailingZeros(n: number) {
  return parseFloat(n.toFixed(2));
}

/**
 * Get the duration of the whole trace as it isn't a part of the response data.
 * Note: Seems like this should be the same as just longest span, but this is probably safer.
 */
function findTraceDuration(view: DataFrameView<Row>): number {
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

/**
 * Returns a map of the spans with children array for easier processing. It will also contain empty spans in case
 * span is missing but other spans are it's children.
 */
function makeSpanMap(view: DataFrameView<Row>): { [id: string]: { span: Row; children: string[] } } {
  const spanMap: { [id: string]: { span?: Row; children: string[] } } = {};

  for (let i = 0; i < view.length; i++) {
    const row = view.get(i);

    if (!spanMap[row.spanID]) {
      spanMap[row.spanID] = {
        // Need copy because of how the view works
        span: { ...row },
        children: [],
      };
    } else {
      spanMap[row.spanID].span = { ...row };
    }
    if (!spanMap[row.parentSpanID]) {
      spanMap[row.parentSpanID] = {
        span: undefined,
        children: [row.spanID],
      };
    } else {
      spanMap[row.parentSpanID].children.push(row.spanID);
    }
  }
  return spanMap as { [id: string]: { span: Row; children: string[] } };
}

/**
 * Get non overlapping duration of the spans.
 */
function getDuration(rows: Row[]): number {
  const ranges = rows.map<[number, number]>((r) => [r.startTime, r.startTime + r.duration]);
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
