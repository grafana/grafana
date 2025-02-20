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

import { nodeR } from './Node';
import { EdgeDatum, GraphFrame, NodeDatum, NodeDatumFromEdge, NodeGraphOptions } from './types';

type Line = { x1: number; y1: number; x2: number; y2: number };

/**
 * Makes line shorter while keeping its middle in the same place.
 * This is manly used to add some empty space between an edge line and its source and target nodes, to make it nicer.
 *
 * @param line a line, where x1 and y1 are the coordinates of the source node center, and x2 and y2 are the coordinates of the target node center
 * @param sourceNodeRadius radius of the source node (possibly taking into account the thickness of the node circumference line, etc.)
 * @param targetNodeRadius radius of the target node (possibly taking into account the thickness of the node circumference line, etc.)
 * @param arrowHeadHeight height of the arrow head (in pixels)
 */
export function shortenLine(line: Line, sourceNodeRadius: number, targetNodeRadius: number, arrowHeadHeight = 1): Line {
  const vx = line.x2 - line.x1;
  const vy = line.y2 - line.y1;
  const mag = Math.sqrt(vx * vx + vy * vy);
  const cosine = (line.x2 - line.x1) / mag;
  const sine = (line.y2 - line.y1) / mag;
  const scaledThickness = arrowHeadHeight - arrowHeadHeight / 10;

  // Reduce the line length (along its main direction) by:
  // - the radius of the source node
  // - the radius of the target node,
  // - a constant value, just to add some empty space
  // - the height of the arrow head; the bigger the arrow head, the better is to add even more empty space
  return {
    x1: line.x1 + cosine * (sourceNodeRadius + 5),
    y1: line.y1 + sine * (sourceNodeRadius + 5),
    x2: line.x2 - cosine * (targetNodeRadius + 3 + scaledThickness),
    y2: line.y2 - sine * (targetNodeRadius + 3 + scaledThickness),
  };
}

export type NodeFields = {
  fixedX?: Field;
  fixedY?: Field;
  id?: Field;
  title?: Field;
  subTitle?: Field;
  mainStat?: Field;
  secondaryStat?: Field;
  arc: Field[];
  details: Field[];
  color?: Field;
  icon?: Field;
  nodeRadius?: Field;
  highlighted?: Field;
  isInstrumented?: Field;
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
    nodeRadius: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.nodeRadius.toLowerCase()),
    highlighted: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.highlighted.toLowerCase()),
    fixedX: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.fixedX.toLowerCase()),
    fixedY: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.fixedY.toLowerCase()),
    isInstrumented: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.isInstrumented.toLowerCase()),
  };
}

export type EdgeFields = {
  id?: Field;
  source?: Field;
  target?: Field;
  mainStat?: Field;
  secondaryStat?: Field;
  details: Field[];
  /**
   * @deprecated use `color` instead
   */
  highlighted?: Field;
  thickness?: Field;
  color?: Field;
  strokeDasharray?: Field;
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
    // @deprecated -- for edges use color instead
    highlighted: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.highlighted.toLowerCase()),
    thickness: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.thickness.toLowerCase()),
    color: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.color.toLowerCase()),
    strokeDasharray: fieldsCache.getFieldByName(NodeGraphDataFrameFieldNames.strokeDasharray.toLowerCase()),
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
  hasFixedPositions?: boolean;
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

    const hasFixedPositions =
      nodeFields.fixedX &&
      nodeFields.fixedX.values.every((v) => Number.isFinite(v)) &&
      nodeFields.fixedY &&
      nodeFields.fixedY.values.every((v) => Number.isFinite(v));

    // Throw an error if somebody is using fixedX and fixedY fields incorrectly. Other option is to ignore this but we
    // are not able to easily combine fixed and non-fixed position in layout so that behaviour would be undefined
    // and silent.
    if (!hasFixedPositions) {
      const somePosFilled =
        (nodeFields.fixedX && nodeFields.fixedX.values.some((v) => Number.isFinite(v))) ||
        (nodeFields.fixedY && nodeFields.fixedY.values.some((v) => Number.isFinite(v)));
      if (somePosFilled) {
        throw new Error('If fixedX and fixedY fields are present, the values have to be all filled and valid');
      }
    }

    // Create the nodes here
    const nodesMap: { [id: string]: NodeDatum } = {};
    for (let i = 0; i < nodeFields.id.values.length; i++) {
      const id = nodeFields.id.values[i];
      nodesMap[id] = makeNodeDatum(id, nodeFields, i);
    }

    // We may not have edges in case of single node
    let edgeDatums: EdgeDatum[] = edges ? processEdges(edges, getEdgeFields(edges), nodesMap) : [];

    for (const e of edgeDatums) {
      // We are adding incoming edges count, so we can later on find out which nodes are the roots
      nodesMap[e.target].incoming++;
    }

    return {
      nodes: Object.values(nodesMap),
      edges: edgeDatums,
      hasFixedPositions,
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

    // Turn edges into reasonable filled in nodes
    for (let i = 0; i < edges.length; i++) {
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
      nodesMap[target.id].incoming++;
    }

    let edgeDatums = processEdges(edges, edgeFields, nodesMap);

    // It is expected for stats to be Field, so we have to create them.
    const nodes = normalizeStatsForNodes(nodesMap, edgeFields);

    return {
      nodes,
      edges: edgeDatums,
      // Edge-only datasets never have fixedX/fixedY
      hasFixedPositions: false,
    };
  }
}

/**
 * Turn data frame data into EdgeDatum that node graph understands
 * @param edges
 * @param edgeFields
 */
function processEdges(edges: DataFrame, edgeFields: EdgeFields, nodesMap: { [id: string]: NodeDatum }): EdgeDatum[] {
  if (!edgeFields.id) {
    throw new Error('id field is required for edges data frame.');
  }

  return edgeFields.id.values.map((id, index) => {
    const target = edgeFields.target?.values[index];
    const source = edgeFields.source?.values[index];

    const sourceNode = nodesMap[source];
    const targetNode = nodesMap[target];

    return {
      id,
      dataFrameRowIndex: index,
      source,
      target,
      sourceNodeRadius: !sourceNode.nodeRadius ? nodeR : sourceNode.nodeRadius.values[sourceNode.dataFrameRowIndex],
      targetNodeRadius: !targetNode.nodeRadius ? nodeR : targetNode.nodeRadius.values[targetNode.dataFrameRowIndex],
      mainStat: edgeFields.mainStat ? statToString(edgeFields.mainStat.config, edgeFields.mainStat.values[index]) : '',
      secondaryStat: edgeFields.secondaryStat
        ? statToString(edgeFields.secondaryStat.config, edgeFields.secondaryStat.values[index])
        : '',
      // @deprecated -- for edges use color instead
      highlighted: edgeFields.highlighted?.values[index] || false,
      thickness: edgeFields.thickness?.values[index] || 1,
      color: edgeFields.color?.values[index],
      strokeDasharray: edgeFields.strokeDasharray?.values[index],
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
  const secondaryStatValues: Array<number | undefined> = [];
  const mainStatValues: Array<number | undefined> = [];
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
    highlighted: false,
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
    nodeRadius: nodeFields.nodeRadius,
    highlighted: nodeFields.highlighted?.values[index] || false,
    x: nodeFields.fixedX?.values[index] ?? undefined,
    y: nodeFields.fixedY?.values[index] ?? undefined,
    isInstrumented: nodeFields.isInstrumented?.values[index] ?? true,
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

export function makeNodesDataFrame(
  count: number,
  partialNodes: Array<Partial<Record<NodeGraphDataFrameFieldNames, unknown>>> = []
) {
  const frame = nodesFrame();
  for (let i = 0; i < count; i++) {
    frame.add(makeNode(i, partialNodes[i]));
  }

  return frame;
}

function makeNode(index: number, partialNode: Partial<Record<NodeGraphDataFrameFieldNames, unknown>> = {}) {
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
    noderadius: 40,
    isinstrumented: true,
    ...partialNode,
  };
}

function nodesFrame() {
  const fields = {
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
      config: { color: { mode: FieldColorModeId.Fixed, fixedColor: 'green' } },
    },
    [NodeGraphDataFrameFieldNames.arc + 'errors']: {
      values: [],
      type: FieldType.number,
      config: { color: { mode: FieldColorModeId.Fixed, fixedColor: 'red' } },
    },
    [NodeGraphDataFrameFieldNames.color]: {
      values: [],
      type: FieldType.number,
      config: { color: { mode: FieldColorModeId.ContinuousGrYlRd } },
    },
    [NodeGraphDataFrameFieldNames.icon]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.nodeRadius]: {
      values: [],
      type: FieldType.number,
    },
    [NodeGraphDataFrameFieldNames.isInstrumented]: {
      values: [],
      type: FieldType.boolean,
    },
  };

  return new MutableDataFrame({
    name: 'nodes',
    fields: Object.entries(fields).map(([key, value]) => ({
      ...value,
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
  const fields = {
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
    fields: Object.entries(fields).map(([key, value]) => ({
      ...value,
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
          // As the arc__ field suffixes can be custom we compare them case insensitively to be safe.
          const field = frame.fields.find((field) => field.name.toLowerCase() === arc.field?.toLowerCase());
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

export const getGraphFrame = (frames: DataFrame[]) => {
  return frames.reduce<GraphFrame>(
    (acc, frame) => {
      const sourceField = frame.fields.filter((f) => f.name === 'source');
      if (frame.name === 'edges' || sourceField.length) {
        acc.edges.push(frame);
      } else {
        acc.nodes.push(frame);
      }
      return acc;
    },
    { edges: [], nodes: [] }
  );
};
