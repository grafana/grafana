import { groupBy } from 'lodash';
import {
  DataFrame,
  DataFrameView,
  DataQueryRequest,
  DataQueryResponse,
  FieldDTO,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames as Fields,
} from '@grafana/data';
import { getNonOverlappingDuration, getStats, makeFrames, makeSpanMap } from '../../../core/utils/tracing';
import { TempoQuery } from './datasource';

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

export function mapPromMetricsToServiceMap(request: DataQueryRequest<TempoQuery>, responses: DataQueryResponse[]) {
  function valueName(metric: string) {
    return `Value #${metric}`;
  }

  const [nodes, edges] = createServiceMapFrames();
  const [totalsDFView, secondsDFView] = getMetricFrames(responses);

  const nodesMap: Record<string, any> = {};
  const edgesMap: Record<string, any> = {};

  for (let i = 0; i < totalsDFView.length; i++) {
    const row = totalsDFView.get(i);
    const edgeId = `${row.client}_${row.server}`;
    edgesMap[edgeId] = {
      total: row[valueName(totalsMetric)],
      target: row.server,
      source: row.client,
    };

    if (!nodesMap[row.server]) {
      nodesMap[row.server] = {
        total: row[valueName(totalsMetric)],
        seconds: 0,
      };
    } else {
      nodesMap[row.server].total += row[valueName(totalsMetric)];
    }

    if (!nodesMap[row.client]) {
      nodesMap[row.client] = {
        total: 0,
        seconds: 0,
      };
    }
  }

  for (let i = 0; i < secondsDFView.length; i++) {
    const row = secondsDFView.get(i);
    const edgeId = `${row.client}_${row.server}`;

    if (!edgesMap[edgeId]) {
      edgesMap[edgeId] = {
        seconds: row[valueName(secondsMetric)],
        target: row.server,
        source: row.client,
      };
    } else {
      edgesMap[edgeId].seconds += row[valueName(secondsMetric)];
    }

    if (!nodesMap[row.server]) {
      nodesMap[row.server] = {
        seconds: row[valueName(secondsMetric)],
        total: 0,
      };
    } else {
      nodesMap[row.server].seconds += row[valueName(secondsMetric)];
    }
  }

  const rangeMs = request.range.to.valueOf() - request.range.from.valueOf();

  for (const nodeId of Object.keys(nodesMap)) {
    const node = nodesMap[nodeId];
    nodes.add({
      id: nodeId,
      title: nodeId,
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
      secondaryStat: edge.total / (rangeMs / (1000 * 60)) + 't/m',
    });
  }

  return [nodes, edges];
}

function createServiceMapFrames() {
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
