import {
  ArrayVector,
  DataFrame,
  Field,
  FieldCache,
  FieldType,
  GrafanaTheme2,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames,
} from '@grafana/data';
import { EdgeDatum, NodeDatum } from './types';

type Line = { x1: number; y1: number; x2: number; y2: number };

/**
 * Makes line shorter while keeping the middle in he same place.
 */
export function shortenLine(line: Line, length: number): Line {
  const vx = line.x2 - line.x1;
  const vy = line.y2 - line.y1;
  const mag = Math.sqrt(vx * vx + vy * vy);
  const ratio = Math.max((mag - length) / mag, 0);
  const vx2 = vx * ratio;
  const vy2 = vy * ratio;
  const xDiff = vx - vx2;
  const yDiff = vy - vy2;
  const newx1 = line.x1 + xDiff / 2;
  const newy1 = line.y1 + yDiff / 2;
  return {
    x1: newx1,
    y1: newy1,
    x2: newx1 + vx2,
    y2: newy1 + vy2,
  };
}

export function getNodeFields(nodes: DataFrame) {
  const fieldsCache = new FieldCache(nodes);
  return {
    id: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id),
    title: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.title),
    subTitle: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.subTitle),
    mainStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.mainStat),
    secondaryStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.secondaryStat),
    arc: findFieldsByPrefix(nodes, NodeGraphDataFrameFieldNames.arc),
    details: findFieldsByPrefix(nodes, NodeGraphDataFrameFieldNames.detail),
    color: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.color),
  };
}

export function getEdgeFields(edges: DataFrame) {
  const fieldsCache = new FieldCache(edges);
  return {
    id: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id),
    source: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.source),
    target: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.target),
    mainStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.mainStat),
    secondaryStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.secondaryStat),
    details: findFieldsByPrefix(edges, NodeGraphDataFrameFieldNames.detail),
  };
}

function findFieldsByPrefix(frame: DataFrame, prefix: string) {
  return frame.fields.filter((f) => f.name.match(new RegExp('^' + prefix)));
}

/**
 * Transform nodes and edges dataframes into array of objects that the layout code can then work with.
 */
export function processNodes(
  nodes: DataFrame | undefined,
  edges: DataFrame | undefined,
  theme: GrafanaTheme2
): {
  nodes: NodeDatum[];
  edges: EdgeDatum[];
  legend?: Array<{
    color: string;
    name: string;
  }>;
} {
  if (!nodes) {
    return { nodes: [], edges: [] };
  }

  const nodeFields = getNodeFields(nodes);
  if (!nodeFields.id) {
    throw new Error('id field is required for nodes data frame.');
  }

  const nodesMap =
    nodeFields.id.values.toArray().reduce<{ [id: string]: NodeDatum }>((acc, id, index) => {
      acc[id] = {
        id: id,
        title: nodeFields.title?.values.get(index) || '',
        subTitle: nodeFields.subTitle ? nodeFields.subTitle.values.get(index) : '',
        dataFrameRowIndex: index,
        incoming: 0,
        mainStat: nodeFields.mainStat,
        secondaryStat: nodeFields.secondaryStat,
        arcSections: nodeFields.arc,
        color: nodeFields.color,
      };
      return acc;
    }, {}) || {};

  let edgesMapped: EdgeDatum[] = [];
  // We may not have edges in case of single node
  if (edges) {
    const edgeFields = getEdgeFields(edges);
    if (!edgeFields.id) {
      throw new Error('id field is required for edges data frame.');
    }

    edgesMapped = edgeFields.id.values.toArray().map((id, index) => {
      const target = edgeFields.target?.values.get(index);
      const source = edgeFields.source?.values.get(index);
      // We are adding incoming edges count so we can later on find out which nodes are the roots
      nodesMap[target].incoming++;

      return {
        id,
        dataFrameRowIndex: index,
        source,
        target,
        mainStat: edgeFields.mainStat ? statToString(edgeFields.mainStat, index) : '',
        secondaryStat: edgeFields.secondaryStat ? statToString(edgeFields.secondaryStat, index) : '',
      } as EdgeDatum;
    });
  }

  return {
    nodes: Object.values(nodesMap),
    edges: edgesMapped || [],
    legend: nodeFields.arc.map((f) => {
      return {
        color: f.config.color?.fixedColor ?? '',
        name: f.config.displayName || f.name,
      };
    }),
  };
}

export function statToString(field: Field, index: number) {
  if (field.type === FieldType.string) {
    return field.values.get(index);
  } else {
    const decimals = field.config.decimals || 2;
    const val = field.values.get(index);
    if (Number.isFinite(val)) {
      return field.values.get(index).toFixed(decimals) + (field.config.unit ? ' ' + field.config.unit : '');
    } else {
      return '';
    }
  }
}

/**
 * Utilities mainly for testing
 */

export function makeNodesDataFrame(count: number) {
  const frame = nodesFrame();
  for (let i = 0; i < count; i++) {
    frame.add(makeNode(i));
  }

  return frame;
}

function makeNode(index: number) {
  return {
    id: index.toString(),
    title: `service:${index}`,
    subTitle: 'service',
    arc__success: 0.5,
    arc__errors: 0.5,
    mainStat: 0.1,
    secondaryStat: 2,
    color: 0.5,
  };
}

function nodesFrame() {
  const fields: any = {
    [NodeGraphDataFrameFieldNames.id]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.title]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.subTitle]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.mainStat]: {
      values: new ArrayVector(),
      type: FieldType.number,
    },
    [NodeGraphDataFrameFieldNames.secondaryStat]: {
      values: new ArrayVector(),
      type: FieldType.number,
    },
    [NodeGraphDataFrameFieldNames.arc + 'success']: {
      values: new ArrayVector(),
      type: FieldType.number,
      config: { color: { fixedColor: 'green' } },
    },
    [NodeGraphDataFrameFieldNames.arc + 'errors']: {
      values: new ArrayVector(),
      type: FieldType.number,
      config: { color: { fixedColor: 'red' } },
    },

    [NodeGraphDataFrameFieldNames.color]: {
      values: new ArrayVector(),
      type: FieldType.number,
      config: { color: { mode: 'continuous-GrYlRd' } },
    },
  };

  return new MutableDataFrame({
    name: 'nodes',
    fields: Object.keys(fields).map((key) => ({
      ...fields[key],
      name: key,
    })),
  });
}

export function makeEdgesDataFrame(edges: Array<[number, number]>) {
  const frame = edgesFrame();
  for (const edge of edges) {
    frame.add({
      id: edge[0] + '--' + edge[1],
      source: edge[0].toString(),
      target: edge[1].toString(),
    });
  }

  return frame;
}

function edgesFrame() {
  const fields: any = {
    [NodeGraphDataFrameFieldNames.id]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.source]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.target]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
  };

  return new MutableDataFrame({
    name: 'edges',
    fields: Object.keys(fields).map((key) => ({
      ...fields[key],
      name: key,
    })),
  });
}

export interface Bounds {
  top: number;
  right: number;
  bottom: number;
  left: number;
  center: {
    x: number;
    y: number;
  };
}

/**
 * Get bounds of the graph meaning the extent of the nodes in all directions.
 */
export function graphBounds(nodes: NodeDatum[]): Bounds {
  if (nodes.length === 0) {
    return { top: 0, right: 0, bottom: 0, left: 0, center: { x: 0, y: 0 } };
  }

  const bounds = nodes.reduce(
    (acc, node) => {
      if (node.x! > acc.right) {
        acc.right = node.x!;
      }
      if (node.x! < acc.left) {
        acc.left = node.x!;
      }
      if (node.y! > acc.bottom) {
        acc.bottom = node.y!;
      }
      if (node.y! < acc.top) {
        acc.top = node.y!;
      }
      return acc;
    },
    { top: Infinity, right: -Infinity, bottom: -Infinity, left: Infinity }
  );

  const y = bounds.top + (bounds.bottom - bounds.top) / 2;
  const x = bounds.left + (bounds.right - bounds.left) / 2;

  return {
    ...bounds,
    center: {
      x,
      y,
    },
  };
}
