import {
  DataFrame,
  DataFrameView,
  DataQueryResponse,
  FieldColorModeId,
  FieldDTO,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames as Fields,
  TimeRange,
} from '@grafana/data';

import { getNonOverlappingDuration, getStats, makeFrames, makeSpanMap } from '../../../core/utils/tracing';

/**
 * Row in a trace dataFrame
 */
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

  const view = new DataFrameView<Row>(data);

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

export const secondsMetric = 'traces_service_graph_request_server_seconds_sum';
export const totalsMetric = 'traces_service_graph_request_total';
export const failedMetric = 'traces_service_graph_request_failed_total';
export const histogramMetric = 'traces_service_graph_request_server_seconds_bucket';

export const rateMetric = {
  expr: 'topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))',
  params: [],
};
export const errorRateMetric = {
  expr: 'topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))',
  params: ['span_status="STATUS_CODE_ERROR"'],
};
export const durationMetric = {
  expr: 'histogram_quantile(.9, sum(rate(traces_spanmetrics_duration_seconds_bucket{}[$__range])) by (le))',
  params: [],
};

export const serviceMapMetrics = [
  secondsMetric,
  totalsMetric,
  failedMetric,
  histogramMetric,
  // These are used for debugging the tempo collection so probably not useful for service map right now.
  // 'traces_service_graph_unpaired_spans_total',
  // 'traces_service_graph_untagged_spans_total',
];

/**
 * Map response from multiple prometheus metrics into a node graph data frames with nodes and edges.
 * @param responses
 * @param range
 */
export function mapPromMetricsToServiceMap(
  responses: DataQueryResponse[],
  range: TimeRange
): { nodes: DataFrame; edges: DataFrame } {
  const frames = getMetricFrames(responses);

  // First just collect data from the metrics into a map with nodes and edges as keys
  const nodesMap: Record<string, ServiceMapStatistics> = {};
  const edgesMap: Record<string, EdgeObject> = {};
  // At this moment we don't have any error/success or other counts so we just use these 2
  collectMetricData(frames[totalsMetric], 'total', totalsMetric, nodesMap, edgesMap);
  collectMetricData(frames[secondsMetric], 'seconds', secondsMetric, nodesMap, edgesMap);
  collectMetricData(frames[failedMetric], 'failed', failedMetric, nodesMap, edgesMap);

  return convertToDataFrames(nodesMap, edgesMap, range);
}

function createServiceMapDataFrames() {
  function createDF(name: string, fields: FieldDTO[]) {
    return new MutableDataFrame({ name, fields, meta: { preferredVisualisationType: 'nodeGraph' } });
  }

  const nodes = createDF('Nodes', [
    { name: Fields.id },
    { name: Fields.title, config: { displayName: 'Service name' } },
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
  const edges = createDF('Edges', [
    { name: Fields.id },
    { name: Fields.source },
    { name: Fields.target },
    { name: Fields.mainStat, config: { unit: 'ms/r', displayName: 'Average response time' } },
    { name: Fields.secondaryStat, config: { unit: 'r/sec', displayName: 'Requests per second' } },
  ]);

  return [nodes, edges];
}

/**
 * Group frames from response based on ref id which is set the same as the metric name so we know which metric is where
 * and also put it into DataFrameView so it's easier to work with.
 * @param responses
 */
function getMetricFrames(responses: DataQueryResponse[]): Record<string, DataFrameView> {
  return responses[0].data.reduce<Record<string, DataFrameView>>((acc, frame) => {
    acc[frame.refId] = new DataFrameView(frame);
    return acc;
  }, {});
}

type ServiceMapStatistics = {
  total?: number;
  seconds?: number;
  failed?: number;
};

type EdgeObject = ServiceMapStatistics & {
  source: string;
  target: string;
};

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
function collectMetricData(
  frame: DataFrameView | undefined,
  stat: keyof ServiceMapStatistics,
  metric: string,
  nodesMap: Record<string, ServiceMapStatistics>,
  edgesMap: Record<string, EdgeObject>
) {
  if (!frame) {
    return;
  }

  // The name of the value column is in this format
  // TODO figure out if it can be changed
  const valueName = `Value #${metric}`;

  for (let i = 0; i < frame.length; i++) {
    const row = frame.get(i);
    const edgeId = `${row.client}_${row.server}`;

    if (!edgesMap[edgeId]) {
      // Create edge as it does not exist yet
      edgesMap[edgeId] = {
        target: row.server,
        source: row.client,
        [stat]: row[valueName],
      };
    } else {
      // Add stat to edge
      // We are adding the values if exists but that should not happen in general as there should be single row for
      // an edge.
      edgesMap[edgeId][stat] = (edgesMap[edgeId][stat] || 0) + row[valueName];
    }

    if (!nodesMap[row.server]) {
      // Create node for server
      nodesMap[row.server] = {
        [stat]: row[valueName],
      };
    } else {
      // Add stat to server node. Sum up values if there are multiple edges targeting this server node.
      nodesMap[row.server][stat] = (nodesMap[row.server][stat] || 0) + row[valueName];
    }

    if (!nodesMap[row.client]) {
      // Create the client node but don't add the stat as edge stats are attributed to the server node. This means for
      // example that the number of requests in a node show how many requests it handled not how many it generated.
      nodesMap[row.client] = {
        [stat]: 0,
      };
    }
  }
}

function convertToDataFrames(
  nodesMap: Record<string, ServiceMapStatistics>,
  edgesMap: Record<string, EdgeObject>,
  range: TimeRange
): { nodes: DataFrame; edges: DataFrame } {
  const rangeMs = range.to.valueOf() - range.from.valueOf();
  const [nodes, edges] = createServiceMapDataFrames();
  for (const nodeId of Object.keys(nodesMap)) {
    const node = nodesMap[nodeId];
    nodes.add({
      [Fields.id]: nodeId,
      [Fields.title]: nodeId,
      // NaN will not be shown in the node graph. This happens for a root client node which did not process
      // any requests itself.
      [Fields.mainStat]: node.total ? (node.seconds! / node.total) * 1000 : Number.NaN, // Average response time
      [Fields.secondaryStat]: node.total ? Math.round((node.total / (rangeMs / 1000)) * 100) / 100 : Number.NaN, // Request per second (to 2 decimals)
      [Fields.arc + 'success']: node.total ? (node.total - Math.min(node.failed || 0, node.total)) / node.total : 1,
      [Fields.arc + 'failed']: node.total ? Math.min(node.failed || 0, node.total) / node.total : 0,
    });
  }
  for (const edgeId of Object.keys(edgesMap)) {
    const edge = edgesMap[edgeId];
    edges.add({
      [Fields.id]: edgeId,
      [Fields.source]: edge.source,
      [Fields.target]: edge.target,
      [Fields.mainStat]: edge.total ? (edge.seconds! / edge.total) * 1000 : Number.NaN, // Average response time
      [Fields.secondaryStat]: edge.total ? Math.round((edge.total / (rangeMs / 1000)) * 100) / 100 : Number.NaN, // Request per second (to 2 decimals)
    });
  }

  return { nodes, edges };
}
