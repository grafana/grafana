import {
  DataFrame,
  Field,
  FieldCache,
  FieldColorModeId,
  FieldConfig,
  FieldType,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames,
} from '@grafana/data';

import { EdgeDatum, NodeDatum, NodeDatumFromEdge, NodeGraphOptions } from './types';

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

export type NodeFields = {
  id?: Field;
  title?: Field;
  subTitle?: Field;
  mainStat?: Field;
  secondaryStat?: Field;
  arc: Field[];
  details: Field[];
  color?: Field;
  icon?: Field;
};

export function getNodeFields(nodes: DataFrame): NodeFields {
  const normalizedFrames = {
    ...nodes,
    fields: nodes.fields.map((field) => ({ ...field, name: field.name.toLowerCase() })),
  };
  const fieldsCache = new FieldCache(normalizedFrames);
  return {
    id: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id.toLowerCase()),
    title: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.title.toLowerCase()),
    subTitle: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.subTitle.toLowerCase()),
    mainStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.mainStat.toLowerCase()),
    secondaryStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.secondaryStat.toLowerCase()),
    arc: findFieldsByPrefix(nodes, NodeGraphDataFrameFieldNames.arc),
    details: findFieldsByPrefix(nodes, NodeGraphDataFrameFieldNames.detail),
    color: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.color),
    icon: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.icon),
  };
}

export type EdgeFields = {
  id?: Field;
  source?: Field;
  target?: Field;
  mainStat?: Field;
  secondaryStat?: Field;
  details: Field[];
};

export function getEdgeFields(edges: DataFrame): EdgeFields {
  const normalizedFrames = {
    ...edges,
    fields: edges.fields.map((field) => ({ ...field, name: field.name.toLowerCase() })),
  };
  const fieldsCache = new FieldCache(normalizedFrames);
  return {
    id: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id.toLowerCase()),
    source: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.source.toLowerCase()),
    target: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.target.toLowerCase()),
    mainStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.mainStat.toLowerCase()),
    secondaryStat: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.secondaryStat.toLowerCase()),
    details: findFieldsByPrefix(edges, NodeGraphDataFrameFieldNames.detail.toLowerCase()),
  };
}

function findFieldsByPrefix(frame: DataFrame, prefix: string): Field[] {
  return frame.fields.filter((f) => f.name.match(new RegExp('^' + prefix)));
}

/**
 * Transform nodes and edges dataframes into array of objects that the layout code can then work with.
 */
export function processNodes(
  nodes: DataFrame | undefined,
  edges: DataFrame | undefined
): {
  nodes: NodeDatum[];
  edges: EdgeDatum[];
  legend?: Array<{
    color: string;
    name: string;
  }>;
} {
  if (!(edges || nodes)) {
    return { nodes: [], edges: [] };
  }

  if (nodes) {
    const nodeFields = getNodeFields(nodes);
    if (!nodeFields.id) {
      throw new Error('id field is required for nodes data frame.');
    }

    // Create the nodes here
    const nodesMap: { [id: string]: NodeDatum } = {};
    for (let i = 0; i < nodeFields.id.values.length; i++) {
      const id = nodeFields.id.values[i];
      nodesMap[id] = makeNodeDatum(id, nodeFields, i);
    }

    // We may not have edges in case of single node
    let edgeDatums: EdgeDatum[] = edges ? processEdges(edges, getEdgeFields(edges)) : [];

    for (const e of edgeDatums) {
      // We are adding incoming edges count, so we can later on find out which nodes are the roots
      nodesMap[e.target].incoming++;
    }

    return {
      nodes: Object.values(nodesMap),
      edges: edgeDatums,
      legend: nodeFields.arc.map((f) => {
        return {
          color: f.config.color?.fixedColor ?? '',
          name: f.config.displayName || f.name,
        };
      }),
    };
  } else {
    // We have only edges here, so we have to construct also nodes out of them

    // We checked that either node || edges has to be defined and if nodes aren't edges has to be defined
    edges = edges!;

    const nodesMap: { [id: string]: NodeDatumFromEdge } = {};

    const edgeFields = getEdgeFields(edges);
    let edgeDatums = processEdges(edges, edgeFields);

    // Turn edges into reasonable filled in nodes
    for (let i = 0; i < edgeDatums.length; i++) {
      const edge = edgeDatums[i];
      const { source, target } = makeNodeDatumsFromEdge(edgeFields, i);

      nodesMap[target.id] = nodesMap[target.id] || target;
      nodesMap[source.id] = nodesMap[source.id] || source;

      // Check the stats fields. They can be also strings which we cannot really aggregate so only aggregate in case
      // they are numbers. Here we just sum all incoming edges to get the final value for node.
      if (computableField(edgeFields.mainStat)) {
        nodesMap[target.id].mainStatNumeric =
          (nodesMap[target.id].mainStatNumeric ?? 0) + edgeFields.mainStat!.values[i];
      }

      if (computableField(edgeFields.secondaryStat)) {
        nodesMap[target.id].secondaryStatNumeric =
          (nodesMap[target.id].secondaryStatNumeric ?? 0) + edgeFields.secondaryStat!.values[i];
      }

      // We are adding incoming edges count, so we can later on find out which nodes are the roots
      nodesMap[edge.target].incoming++;
    }

    // It is expected for stats to be Field, so we have to create them.
    const nodes = normalizeStatsForNodes(nodesMap, edgeFields);

    return {
      nodes,
      edges: edgeDatums,
    };
  }
}

/**
 * Turn data frame data into EdgeDatum that node graph understands
 * @param edges
 * @param edgeFields
 */
function processEdges(edges: DataFrame, edgeFields: EdgeFields): EdgeDatum[] {
  if (!edgeFields.id) {
    throw new Error('id field is required for edges data frame.');
  }

  return edgeFields.id.values.map((id, index) => {
    const target = edgeFields.target?.values[index];
    const source = edgeFields.source?.values[index];

    return {
      id,
      dataFrameRowIndex: index,
      source,
      target,
      mainStat: edgeFields.mainStat ? statToString(edgeFields.mainStat.config, edgeFields.mainStat.values[index]) : '',
      secondaryStat: edgeFields.secondaryStat
        ? statToString(edgeFields.secondaryStat.config, edgeFields.secondaryStat.values[index])
        : '',
    };
  });
}

function computableField(field?: Field) {
  return field && field.type === FieldType.number;
}

/**
 * Instead of just simple numbers node graph requires to have Field in NodeDatum (probably for some formatting info in
 * config). So we create them here and fill with correct data.
 * @param nodesMap
 * @param edgeFields
 */
function normalizeStatsForNodes(nodesMap: { [id: string]: NodeDatumFromEdge }, edgeFields: EdgeFields): NodeDatum[] {
  const secondaryStatValues: any[] = [];
  const mainStatValues: any[] = [];
  const secondaryStatField = computableField(edgeFields.secondaryStat)
    ? {
        ...edgeFields.secondaryStat!,
        values: secondaryStatValues,
      }
    : undefined;

  const mainStatField = computableField(edgeFields.mainStat)
    ? {
        ...edgeFields.mainStat!,
        values: mainStatValues,
      }
    : undefined;

  return Object.values(nodesMap).map((node, index) => {
    if (mainStatField || secondaryStatField) {
      const newNode = {
        ...node,
      };

      if (mainStatField) {
        newNode.mainStat = mainStatField;
        mainStatValues.push(node.mainStatNumeric);
        newNode.dataFrameRowIndex = index;
      }

      if (secondaryStatField) {
        newNode.secondaryStat = secondaryStatField;
        secondaryStatValues.push(node.secondaryStatNumeric);
        newNode.dataFrameRowIndex = index;
      }
      return newNode;
    }
    return node;
  });
}

function makeNodeDatumsFromEdge(edgeFields: EdgeFields, index: number) {
  const targetId = edgeFields.target?.values[index];
  const sourceId = edgeFields.source?.values[index];
  return {
    target: makeSimpleNodeDatum(targetId, index),
    source: makeSimpleNodeDatum(sourceId, index),
  };
}

function makeSimpleNodeDatum(name: string, index: number): NodeDatumFromEdge {
  return {
    id: name,
    title: name,
    subTitle: '',
    dataFrameRowIndex: index,
    incoming: 0,
    arcSections: [],
  };
}

function makeNodeDatum(id: string, nodeFields: NodeFields, index: number): NodeDatum {
  return {
    id: id,
    title: nodeFields.title?.values[index] || '',
    subTitle: nodeFields.subTitle?.values[index] || '',
    dataFrameRowIndex: index,
    incoming: 0,
    mainStat: nodeFields.mainStat,
    secondaryStat: nodeFields.secondaryStat,
    arcSections: nodeFields.arc,
    color: nodeFields.color,
    icon: nodeFields.icon?.values[index] || '',
  };
}

export function statToString(config: FieldConfig, value: number | string): string {
  if (typeof value === 'string') {
    return value;
  } else {
    const decimals = config.decimals || 2;
    if (Number.isFinite(value)) {
      return value.toFixed(decimals) + (config.unit ? ' ' + config.unit : '');
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
    subtitle: 'service',
    arc__success: 0.5,
    arc__errors: 0.5,
    mainstat: 0.1,
    secondarystat: 2,
    color: 0.5,
    icon: 'database',
  };
}

function nodesFrame() {
  const fields: any = {
    [NodeGraphDataFrameFieldNames.id]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.title]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.subTitle]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.mainStat]: {
      values: [],
      type: FieldType.number,
    },
    [NodeGraphDataFrameFieldNames.secondaryStat]: {
      values: [],
      type: FieldType.number,
    },
    [NodeGraphDataFrameFieldNames.arc + 'success']: {
      values: [],
      type: FieldType.number,
      config: { color: { fixedColor: 'green' } },
    },
    [NodeGraphDataFrameFieldNames.arc + 'errors']: {
      values: [],
      type: FieldType.number,
      config: { color: { fixedColor: 'red' } },
    },
    [NodeGraphDataFrameFieldNames.color]: {
      values: [],
      type: FieldType.number,
      config: { color: { mode: 'continuous-GrYlRd' } },
    },
    [NodeGraphDataFrameFieldNames.icon]: {
      values: [],
      type: FieldType.string,
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

export function makeEdgesDataFrame(
  edges: Array<Partial<{ source: string; target: string; mainstat: number; secondarystat: number }>>
) {
  const frame = edgesFrame();
  for (const edge of edges) {
    frame.add({
      id: edge.source + '--' + edge.target,
      ...edge,
    });
  }

  return frame;
}

function edgesFrame() {
  const fields: any = {
    [NodeGraphDataFrameFieldNames.id]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.source]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.target]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.mainStat]: {
      values: [],
      type: FieldType.number,
    },
    [NodeGraphDataFrameFieldNames.secondaryStat]: {
      values: [],
      type: FieldType.number,
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

export function getNodeGraphDataFrames(frames: DataFrame[], options?: NodeGraphOptions) {
  // TODO: this not in sync with how other types of responses are handled. Other types have a query response
  //  processing pipeline which ends up populating redux state with proper data. As we move towards more dataFrame
  //  oriented API it seems like a better direction to move such processing into to visualisations and do minimal
  //  and lazy processing here. Needs bigger refactor so keeping nodeGraph and Traces as they are for now.
  let nodeGraphFrames = frames.filter((frame) => {
    if (frame.meta?.preferredVisualisationType === 'nodeGraph') {
      return true;
    }

    if (frame.name === 'nodes' || frame.name === 'edges' || frame.refId === 'nodes' || frame.refId === 'edges') {
      return true;
    }

    const fieldsCache = new FieldCache(frame);
    if (fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.id)) {
      return true;
    }

    return false;
  });

  // If panel options are provided, interpolate their values in to the data frames
  if (options) {
    nodeGraphFrames = applyOptionsToFrames(nodeGraphFrames, options);
  }
  return nodeGraphFrames;
}

export const applyOptionsToFrames = (frames: DataFrame[], options: NodeGraphOptions): DataFrame[] => {
  return frames.map((frame) => {
    const fieldsCache = new FieldCache(frame);

    // Edges frame has source which can be used to identify nodes vs edges frames
    if (fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.source.toLowerCase())) {
      if (options?.edges?.mainStatUnit) {
        const field = frame.fields.find((field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.mainStat);
        if (field) {
          field.config = { ...field.config, unit: options.edges.mainStatUnit };
        }
      }
      if (options?.edges?.secondaryStatUnit) {
        const field = frame.fields.find(
          (field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.secondaryStat
        );
        if (field) {
          field.config = { ...field.config, unit: options.edges.secondaryStatUnit };
        }
      }
    } else {
      if (options?.nodes?.mainStatUnit) {
        const field = frame.fields.find((field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.mainStat);
        if (field) {
          field.config = { ...field.config, unit: options.nodes.mainStatUnit };
        }
      }
      if (options?.nodes?.secondaryStatUnit) {
        const field = frame.fields.find(
          (field) => field.name.toLowerCase() === NodeGraphDataFrameFieldNames.secondaryStat
        );
        if (field) {
          field.config = { ...field.config, unit: options.nodes.secondaryStatUnit };
        }
      }
      if (options?.nodes?.arcs?.length) {
        for (const arc of options.nodes.arcs) {
          const field = frame.fields.find((field) => field.name.toLowerCase() === arc.field);
          if (field && arc.color) {
            field.config = { ...field.config, color: { fixedColor: arc.color, mode: FieldColorModeId.Fixed } };
          }
        }
      }
    }
    return frame;
  });
};

// Returns an array of node ids which are connected to a given edge
export const findConnectedNodesForEdge = (nodes: NodeDatum[], edges: EdgeDatum[], edgeId: string): string[] => {
  const edge = edges.find((edge) => edge.id === edgeId);
  if (edge) {
    return [
      ...new Set(nodes.filter((node) => edge.source === node.id || edge.target === node.id).map((node) => node.id)),
    ];
  }
  return [];
};

// Returns an array of node ids which are connected to a given node
export const findConnectedNodesForNode = (nodes: NodeDatum[], edges: EdgeDatum[], nodeId: string): string[] => {
  const node = nodes.find((node) => node.id === nodeId);
  if (node) {
    const linkedEdges = edges.filter((edge) => edge.source === node.id || edge.target === node.id);
    return [
      ...new Set(
        linkedEdges.flatMap((edge) =>
          nodes.filter((n) => edge.source === n.id || edge.target === n.id).map((n) => n.id)
        )
      ),
    ];
  }
  return [];
};
