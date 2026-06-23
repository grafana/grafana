import {
  type DataFrame,
  FieldType,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames as Fields,
} from '@grafana/data';

const HOST_ATTR = 'resource.service.name';
const DEST_ATTR = 'span.destination.address';

export interface FlowEdgeDatum {
  host: string;
  destination: string;
  count: number;
  bytes: number;
}

function lastSample(frame: DataFrame): number {
  const field = frame.fields.find((f) => f.type === FieldType.number);
  if (!field) {
    return 0;
  }
  const arr = field.values.toArray ? field.values.toArray() : (field.values as unknown as number[]);
  return Number(arr[arr.length - 1] ?? 0);
}

function labelsOf(frame: DataFrame): Record<string, string> {
  const field = frame.fields.find((f) => f.type === FieldType.number);
  return field?.labels ?? {};
}

export function extractFlowEdges(countFrames: DataFrame[], bytesFrames: DataFrame[]): FlowEdgeDatum[] {
  const bytesByKey = new Map<string, number>();
  for (const frame of bytesFrames) {
    const labels = labelsOf(frame);
    const host = labels[HOST_ATTR];
    const dest = labels[DEST_ATTR];
    if (host === undefined || dest === undefined) {
      continue;
    }
    bytesByKey.set(`${host} ${dest}`, lastSample(frame));
  }

  const edges: FlowEdgeDatum[] = [];
  for (const frame of countFrames) {
    const labels = labelsOf(frame);
    const host = labels[HOST_ATTR];
    const dest = labels[DEST_ATTR];
    if (host === undefined || dest === undefined) {
      continue;
    }
    edges.push({
      host,
      destination: dest,
      count: lastSample(frame),
      bytes: bytesByKey.get(`${host} ${dest}`) ?? 0,
    });
  }
  return edges;
}

export function flowEdgesToNodeGraph(edges: FlowEdgeDatum[]): { nodes: DataFrame; edges: DataFrame } {
  const nodes = new MutableDataFrame({
    name: 'Nodes',
    meta: { preferredVisualisationType: 'nodeGraph' },
    fields: [
      { name: Fields.id, type: FieldType.string, values: [] },
      { name: Fields.title, type: FieldType.string, config: { displayName: 'Endpoint' }, values: [] },
      { name: Fields.subTitle, type: FieldType.string, config: { displayName: 'Role' }, values: [] },
      {
        name: Fields.mainStat,
        type: FieldType.number,
        config: { displayName: 'Flows' },
        values: [],
      },
    ],
  });

  const edgeFrame = new MutableDataFrame({
    name: 'Edges',
    meta: { preferredVisualisationType: 'nodeGraph' },
    fields: [
      { name: Fields.id, type: FieldType.string, values: [] },
      { name: Fields.source, type: FieldType.string, values: [] },
      { name: Fields.target, type: FieldType.string, values: [] },
      { name: Fields.mainStat, type: FieldType.number, config: { displayName: 'Flows' }, values: [] },
      { name: Fields.secondaryStat, type: FieldType.number, config: { unit: 'bytes', displayName: 'Bytes' }, values: [] },
    ],
  });

  const nodeFlows = new Map<string, { title: string; role: string; flows: number }>();
  const ensureNode = (id: string, title: string, role: string) => {
    if (!nodeFlows.has(id)) {
      nodeFlows.set(id, { title, role, flows: 0 });
    }
  };

  for (const edge of edges) {
    const sourceId = `host:${edge.host}`;
    const targetId = `dest:${edge.destination}`;
    ensureNode(sourceId, edge.host, 'host');
    ensureNode(targetId, edge.destination, 'destination');
    nodeFlows.get(sourceId)!.flows += edge.count;
    nodeFlows.get(targetId)!.flows += edge.count;

    edgeFrame.add({
      [Fields.id]: `${sourceId}__${targetId}`,
      [Fields.source]: sourceId,
      [Fields.target]: targetId,
      [Fields.mainStat]: edge.count,
      [Fields.secondaryStat]: edge.bytes,
    });
  }

  for (const [id, node] of nodeFlows) {
    nodes.add({
      [Fields.id]: id,
      [Fields.title]: node.title,
      [Fields.subTitle]: node.role,
      [Fields.mainStat]: node.flows,
    });
  }

  return { nodes, edges: edgeFrame };
}
