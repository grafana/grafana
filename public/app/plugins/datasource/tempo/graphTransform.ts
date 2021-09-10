import { groupBy } from 'lodash';
import {
  DataFrame,
  DataFrameView,
  DataQueryResponse,
  FieldDTO,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames as Fields,
  TimeRange,
} from '@grafana/data';
import { getNonOverlappingDuration, getStats, makeFrames, makeSpanMap } from '../../../core/utils/tracing';

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

const secondsMetric = 'tempo_service_graph_request_server_seconds_sum';
const totalsMetric = 'tempo_service_graph_request_total';

export const serviceMapMetrics = [
  secondsMetric,
  totalsMetric,
  // We don't show histogram in node graph at the moment but we could later add that into a node context menu.
  // 'tempo_service_graph_request_seconds_bucket',
  // 'tempo_service_graph_request_seconds_count',
  // These are used for debugging the tempo collection so probably not useful for service map right now.
  // 'tempo_service_graph_unpaired_spans_total',
  // 'tempo_service_graph_untagged_spans_total',
];

/**
 * Map response from multiple prometheus metrics into a node graph data frames with nodes and edges.
 * @param responses
 * @param range
 */
export function mapPromMetricsToServiceMap(responses: DataQueryResponse[], range: TimeRange): [DataFrame, DataFrame] {
  const [totalsDFView, secondsDFView] = getMetricFrames(responses);

  // First just collect data from the metrics into a map with nodes and edges as keys
  const nodesMap: Record<string, any> = {};
  const edgesMap: Record<string, any> = {};
  // At this moment we don't have any error/success or other counts so we just use these 2
  collectMetricData(totalsDFView, 'total', totalsMetric, nodesMap, edgesMap);
  collectMetricData(secondsDFView, 'seconds', secondsMetric, nodesMap, edgesMap);

  return convertToDataFrames(nodesMap, edgesMap, range);
}

function createServiceMapDataFrames() {
  function createDF(name: string, fields: FieldDTO[]) {
    return new MutableDataFrame({ name, fields, meta: { preferredVisualisationType: 'nodeGraph' } });
  }

  const nodes = createDF('Nodes', [
    { name: Fields.id },
    { name: Fields.title },
    { name: Fields.mainStat, config: { unit: 'ms/t', displayName: 'Average response time' } },
    {
      name: Fields.secondaryStat,
      config: { unit: 't/min', displayName: 'Transactions per minute' },
    },
  ]);
  const edges = createDF('Edges', [
    { name: Fields.id },
    { name: Fields.source },
    { name: Fields.target },
    { name: Fields.mainStat, config: { unit: 't', displayName: 'Transactions' } },
    { name: Fields.secondaryStat, config: { unit: 'ms/t', displayName: 'Average response time' } },
  ]);

  return [nodes, edges];
}

function getMetricFrames(responses: DataQueryResponse[]) {
  const responsesMap = groupBy(responses, (r) => r.data[0].refId);
  const totalsDFView = new DataFrameView(responsesMap[totalsMetric][0].data[0]);
  const secondsDFView = new DataFrameView(responsesMap[secondsMetric][0].data[0]);
  return [totalsDFView, secondsDFView];
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
  frame: DataFrameView,
  stat: 'total' | 'seconds',
  metric: string,
  nodesMap: Record<string, any>,
  edgesMap: Record<string, any>
) {
  // The name of the value column is in this format
  // TODO figure out if it can be changed
  const valueName = `Value #${metric}`;

  for (let i = 0; i < frame.length; i++) {
    const row = frame.get(i);
    const edgeId = `${row.client}_${row.server}`;

    if (!edgesMap[edgeId]) {
      edgesMap[edgeId] = {
        target: row.server,
        source: row.client,
        [stat]: row[valueName],
      };
    } else {
      edgesMap[edgeId][stat] = (edgesMap[edgeId][stat] || 0) + row[valueName];
    }

    if (!nodesMap[row.server]) {
      nodesMap[row.server] = {
        [stat]: row[valueName],
      };
    } else {
      nodesMap[row.server][stat] = (nodesMap[row.server][stat] || 0) + row[valueName];
    }

    if (!nodesMap[row.client]) {
      nodesMap[row.client] = {
        [stat]: 0,
      };
    }
  }
}

function convertToDataFrames(
  nodesMap: Record<string, any>,
  edgesMap: Record<string, any>,
  range: TimeRange
): [DataFrame, DataFrame] {
  const rangeMs = range.to.valueOf() - range.from.valueOf();
  const [nodes, edges] = createServiceMapDataFrames();
  for (const nodeId of Object.keys(nodesMap)) {
    const node = nodesMap[nodeId];
    nodes.add({
      id: nodeId,
      title: nodeId,
      // NaN will not be shown in the node graph. This happens for a root client node which did not process
      // any requests itself.
      mainStat: node.total ? (node.seconds / node.total) * 1000 : Number.NaN,
      secondaryStat: node.total ? node.total / (rangeMs / (1000 * 60)) : Number.NaN,
    });
  }
  for (const edgeId of Object.keys(edgesMap)) {
    const edge = edgesMap[edgeId];
    edges.add({
      id: edgeId,
      source: edge.source,
      target: edge.target,
      mainStat: edge.total,
      secondaryStat: edge.total ? (edge.seconds / edge.total) * 1000 : Number.NaN,
    });
  }

  return [nodes, edges];
}
