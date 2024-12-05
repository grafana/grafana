import {
  DataFrame,
  DataFrameView,
  DataQueryResponse,
  FieldColorModeId,
  FieldDTO,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames as Fields,
  TimeRange,
  FieldType,
  toDataFrame,
} from '@grafana/data';

export const secondsMetric = 'traces_service_graph_request_server_seconds_sum';
export const totalsMetric = 'traces_service_graph_request_total';
export const failedMetric = 'traces_service_graph_request_failed_total';
export const histogramMetric = 'traces_service_graph_request_server_seconds_bucket';

export const rateMetric = {
  expr: 'sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name)',
  topk: 5,
  params: [],
};
export const errorRateMetric = {
  expr: 'sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name)',
  topk: 5,
  params: ['status_code="STATUS_CODE_ERROR"'],
};
export const durationMetric = {
  expr: 'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{}[$__range])) by (le))',
  params: [],
};
export const defaultTableFilter = 'span_kind="SPAN_KIND_SERVER"';

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
  const nodesMap: Record<string, NodeObject> = {};
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
    { name: Fields.id, type: FieldType.string, values: [] },
    { name: Fields.title, type: FieldType.string, config: { displayName: 'Service name' }, values: [] },
    { name: Fields.subTitle, type: FieldType.string, config: { displayName: 'Service namespace' }, values: [] },
    {
      name: Fields.mainStat,
      type: FieldType.number,
      config: { unit: 'ms/r', displayName: 'Average response time' },
      values: [],
    },
    {
      name: Fields.secondaryStat,
      type: FieldType.number,
      config: { unit: 'r/sec', displayName: 'Requests per second' },
      values: [],
    },
    {
      name: Fields.arc + 'success',
      type: FieldType.number,
      config: { displayName: 'Success', color: { fixedColor: 'green', mode: FieldColorModeId.Fixed } },
      values: [],
    },
    {
      name: Fields.arc + 'failed',
      type: FieldType.number,
      config: { displayName: 'Failed', color: { fixedColor: 'red', mode: FieldColorModeId.Fixed } },
      values: [],
    },
  ]);
  const edges = createDF('Edges', [
    { name: Fields.id, type: FieldType.string, values: [] },
    { name: Fields.source, type: FieldType.string, values: [] },
    { name: AdditionalEdgeFields.sourceName, type: FieldType.string, values: [] },
    { name: AdditionalEdgeFields.sourceNamespace, type: FieldType.string, values: [] },
    { name: Fields.target, type: FieldType.string, values: [] },
    { name: AdditionalEdgeFields.targetName, type: FieldType.string, values: [] },
    { name: AdditionalEdgeFields.targetNamespace, type: FieldType.string, values: [] },
    {
      name: Fields.mainStat,
      type: FieldType.number,
      config: { unit: 'ms/r', displayName: 'Average response time' },
      values: [],
    },
    {
      name: Fields.secondaryStat,
      type: FieldType.number,
      config: { unit: 'r/sec', displayName: 'Requests per second' },
      values: [],
    },
  ]);

  return [nodes, edges];
}

/**
 * Group frames from response based on ref id which is set the same as the metric name so we know which metric is where
 * and also put it into DataFrameView so it's easier to work with.
 * @param responses
 */
function getMetricFrames(responses: DataQueryResponse[]): Record<string, DataFrameView> {
  return (responses[0]?.data || []).reduce<Record<string, DataFrameView>>((acc, frameDTO) => {
    const frame = toDataFrame(frameDTO);
    acc[frame.refId ?? 'A'] = new DataFrameView(frame);
    return acc;
  }, {});
}

type ServiceMapStatistics = {
  total?: number;
  seconds?: number;
  failed?: number;
};

type NodeObject = ServiceMapStatistics & {
  name: string;
  namespace?: string;
};

type EdgeObject = ServiceMapStatistics & {
  source: string;
  sourceName: string;
  sourceNamespace: string;
  target: string;
  targetName: string;
  targetNamespace: string;
};

// These fields are not necessary for rendering, so not available from the Fields enum
// Will be used for linking when namespace is present
enum AdditionalEdgeFields {
  sourceName = 'sourceName',
  sourceNamespace = 'sourceNamespace',
  targetName = 'targetName',
  targetNamespace = 'targetNamespace',
}

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
  nodesMap: Record<string, NodeObject>,
  edgesMap: Record<string, EdgeObject>
) {
  if (!frame) {
    return;
  }

  // The name of the value column is in this format
  // Improvement: figure out if it can be changed
  const valueName = `Value #${metric}`;

  for (let i = 0; i < frame.length; i++) {
    const row = frame.get(i);
    const serverId = row.server_service_namespace ? `${row.server_service_namespace}/${row.server}` : row.server;
    const clientId = row.client_service_namespace ? `${row.client_service_namespace}/${row.client}` : row.client;

    const edgeId = `${clientId}_${serverId}`;

    if (!edgesMap[edgeId]) {
      // Create edge as it does not exist yet
      edgesMap[edgeId] = {
        target: serverId,
        targetName: row.server,
        targetNamespace: row.server_service_namespace,
        source: clientId,
        sourceName: row.client,
        sourceNamespace: row.client_service_namespace,
        [stat]: row[valueName],
      };
    } else {
      // Add stat to edge
      // We are adding the values if exists but that should not happen in general as there should be single row for
      // an edge.
      edgesMap[edgeId][stat] = (edgesMap[edgeId][stat] || 0) + row[valueName];
    }

    if (!nodesMap[serverId]) {
      // Create node for server
      nodesMap[serverId] = {
        name: row.server,
        namespace: row.server_service_namespace,
        [stat]: row[valueName],
      };
    } else {
      // Add stat to server node. Sum up values if there are multiple edges targeting this server node.
      nodesMap[serverId][stat] = (nodesMap[serverId][stat] || 0) + row[valueName];
    }

    if (!nodesMap[clientId]) {
      // Create the client node but don't add the stat as edge stats are attributed to the server node. This means for
      // example that the number of requests in a node show how many requests it handled not how many it generated.
      nodesMap[clientId] = {
        name: row.client,
        namespace: row.client_service_namespace,
        [stat]: 0,
      };
    }
  }
}

function convertToDataFrames(
  nodesMap: Record<string, NodeObject>,
  edgesMap: Record<string, EdgeObject>,
  range: TimeRange
): { nodes: DataFrame; edges: DataFrame } {
  const [nodes, edges] = createServiceMapDataFrames();
  for (const nodeId of Object.keys(nodesMap)) {
    const node = nodesMap[nodeId];
    nodes.add({
      [Fields.id]: nodeId,
      [Fields.title]: node.name,
      [Fields.subTitle]: node.namespace,
      // NaN will not be shown in the node graph. This happens for a root client node which did not process
      // any requests itself.
      [Fields.mainStat]: node.total ? (node.seconds! / node.total) * 1000 : Number.NaN, // Average response time
      [Fields.secondaryStat]: node.total ? Math.round(node.total * 100) / 100 : Number.NaN, // Request per second (to 2 decimals)
      [Fields.arc + 'success']: node.total ? (node.total - Math.min(node.failed || 0, node.total)) / node.total : 1,
      [Fields.arc + 'failed']: node.total ? Math.min(node.failed || 0, node.total) / node.total : 0,
    });
  }
  for (const edgeId of Object.keys(edgesMap)) {
    const edge = edgesMap[edgeId];
    edges.add({
      [Fields.id]: edgeId,
      [Fields.source]: edge.source,
      [AdditionalEdgeFields.sourceName]: edge.sourceName,
      [AdditionalEdgeFields.sourceNamespace]: edge.sourceNamespace,
      [Fields.target]: edge.target,
      [AdditionalEdgeFields.targetName]: edge.targetName,
      [AdditionalEdgeFields.targetNamespace]: edge.targetNamespace,
      [Fields.mainStat]: edge.total ? (edge.seconds! / edge.total) * 1000 : Number.NaN, // Average response time
      [Fields.secondaryStat]: edge.total ? Math.round(edge.total * 100) / 100 : Number.NaN, // Request per second (to 2 decimals)
    });
  }

  return { nodes, edges };
}
