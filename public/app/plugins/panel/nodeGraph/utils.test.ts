import { DataFrame, FieldType, createDataFrame, NodeGraphDataFrameFieldNames } from '@grafana/data';

import { NodeDatum, NodeGraphOptions } from './types';
import {
  findConnectedNodesForEdge,
  findConnectedNodesForNode,
  getEdgeFields,
  getNodeFields,
  getNodeGraphDataFrames,
  makeEdgesDataFrame,
  makeNodesDataFrame,
  processNodes,
} from './utils';

describe('processNodes', () => {
  it('handles empty args', async () => {
    expect(processNodes(undefined, undefined)).toEqual({ nodes: [], edges: [] });
  });

  it('returns proper nodes and edges', async () => {
    const { nodes, edges, legend } = processNodes(
      makeNodesDataFrame(3, [{ isinstrumented: false }]),
      makeEdgesDataFrame([
        { source: '0', target: '1' },
        { source: '0', target: '2' },
        { source: '1', target: '2' },
      ])
    );

    expect(nodes).toEqual([
      makeNodeDatum({ isInstrumented: false }),
      makeNodeDatum({ dataFrameRowIndex: 1, id: '1', incoming: 1, title: 'service:1' }),
      makeNodeDatum({ dataFrameRowIndex: 2, id: '2', incoming: 2, title: 'service:2' }),
    ]);

    expect(edges).toEqual([makeEdgeDatum('0--1', 0), makeEdgeDatum('0--2', 1), makeEdgeDatum('1--2', 2)]);

    expect(legend).toEqual([
      {
        color: 'green',
        name: 'arc__success',
      },
      {
        color: 'red',
        name: 'arc__errors',
      },
    ]);
  });

  it('returns nodes just from edges dataframe', () => {
    const { nodes, edges } = processNodes(
      undefined,
      makeEdgesDataFrame([
        { source: '0', target: '1', mainstat: 1, secondarystat: 1 },
        { source: '0', target: '2', mainstat: 1, secondarystat: 1 },
        { source: '1', target: '2', mainstat: 1, secondarystat: 1 },
      ])
    );

    expect(nodes).toEqual([
      expect.objectContaining(makeNodeFromEdgeDatum({ dataFrameRowIndex: 0, title: '0' })),
      expect.objectContaining(makeNodeFromEdgeDatum({ dataFrameRowIndex: 1, id: '1', incoming: 1, title: '1' })),
      expect.objectContaining(makeNodeFromEdgeDatum({ dataFrameRowIndex: 2, id: '2', incoming: 2, title: '2' })),
    ]);

    expect(nodes[0].mainStat?.values).toEqual([undefined, 1, 2]);
    expect(nodes[0].secondaryStat?.values).toEqual([undefined, 1, 2]);

    expect(nodes[0].mainStat).toEqual(nodes[1].mainStat);
    expect(nodes[0].mainStat).toEqual(nodes[2].mainStat);

    expect(nodes[0].secondaryStat).toEqual(nodes[1].secondaryStat);
    expect(nodes[0].secondaryStat).toEqual(nodes[2].secondaryStat);

    expect(edges).toEqual([
      makeEdgeDatum('0--1', 0, '1.00', '1.00'),
      makeEdgeDatum('0--2', 1, '1.00', '1.00'),
      makeEdgeDatum('1--2', 2, '1.00', '1.00'),
    ]);
  });

  it('detects dataframes correctly', () => {
    const validFrames = [
      createDataFrame({
        refId: 'hasPreferredVisualisationType',
        fields: [],
        meta: {
          preferredVisualisationType: 'nodeGraph',
        },
      }),
      createDataFrame({
        refId: 'hasName',
        fields: [],
        name: 'nodes',
      }),
      createDataFrame({
        refId: 'nodes', // hasRefId
        fields: [],
      }),
      createDataFrame({
        refId: 'hasValidNodesShape',
        fields: [{ name: 'id', type: FieldType.string }],
      }),
      createDataFrame({
        refId: 'hasValidEdgesShape',
        fields: [
          { name: 'id', type: FieldType.string },
          { name: 'source', type: FieldType.string },
          { name: 'target', type: FieldType.string },
        ],
      }),
    ];
    const invalidFrames = [
      createDataFrame({
        refId: 'invalidData',
        fields: [],
      }),
    ];
    const frames = [...validFrames, ...invalidFrames];

    const nodeGraphFrames = getNodeGraphDataFrames(frames as DataFrame[]);
    expect(nodeGraphFrames.length).toBe(5);
    expect(nodeGraphFrames).toEqual(validFrames);
  });

  it('getting fields is case insensitive', () => {
    const nodeFrame = createDataFrame({
      refId: 'nodes',
      fields: [
        { name: 'id', type: FieldType.string, values: ['id'] },
        { name: 'title', type: FieldType.string, values: ['title'] },
        { name: 'SUBTITLE', type: FieldType.string, values: ['subTitle'] },
        { name: 'mainstat', type: FieldType.string, values: ['mainStat'] },
        { name: 'seconDarysTat', type: FieldType.string, values: ['secondaryStat'] },
        { name: 'nodeRadius', type: FieldType.number, values: [20] },
      ],
    });

    const nodeFields = getNodeFields(nodeFrame);
    expect(nodeFields.id).toBeDefined();
    expect(nodeFields.title).toBeDefined();
    expect(nodeFields.subTitle).toBeDefined();
    expect(nodeFields.mainStat).toBeDefined();
    expect(nodeFields.secondaryStat).toBeDefined();

    const edgeFrame = createDataFrame({
      refId: 'nodes',
      fields: [
        { name: 'id', type: FieldType.string, values: ['id'] },
        { name: 'source', type: FieldType.string, values: ['title'] },
        { name: 'TARGET', type: FieldType.string, values: ['subTitle'] },
        { name: 'mainstat', type: FieldType.string, values: ['mainStat'] },
        { name: 'secondarystat', type: FieldType.string, values: ['secondaryStat'] },
      ],
    });
    const edgeFields = getEdgeFields(edgeFrame);
    expect(edgeFields.id).toBeDefined();
    expect(edgeFields.source).toBeDefined();
    expect(edgeFields.target).toBeDefined();
    expect(edgeFields.mainStat).toBeDefined();
    expect(edgeFields.secondaryStat).toBeDefined();
  });

  it('interpolates panel options correctly', () => {
    const frames = [
      createDataFrame({
        refId: 'nodes',
        fields: [
          { name: 'id', type: FieldType.string },
          { name: 'mainStat', type: FieldType.string },
          { name: 'secondaryStat', type: FieldType.string },
          { name: 'arc__primary', type: FieldType.string },
          { name: 'arc__Secondary', type: FieldType.string },
          { name: 'arc__tertiary', type: FieldType.string },
        ],
      }),
      createDataFrame({
        refId: 'edges',
        fields: [
          { name: 'id', type: FieldType.string },
          { name: 'source', type: FieldType.string },
          { name: 'target', type: FieldType.string },
          { name: 'mainStat', type: FieldType.string },
          { name: 'secondaryStat', type: FieldType.string },
        ],
      }),
    ];

    const panelOptions: NodeGraphOptions = {
      nodes: {
        mainStatUnit: 'r/min',
        secondaryStatUnit: 'ms/r',
        arcs: [
          { field: 'arc__primary', color: 'red' },
          { field: 'arc__Secondary', color: 'yellow' },
          { field: 'arc__tertiary', color: '#dd40ec' },
        ],
      },
      edges: {
        mainStatUnit: 'r/sec',
        secondaryStatUnit: 'ft^2',
      },
    };

    const nodeGraphFrames = getNodeGraphDataFrames(frames, panelOptions);
    expect(nodeGraphFrames).toHaveLength(2);

    const nodesFrame = nodeGraphFrames.find((f) => f.refId === 'nodes');
    expect(nodesFrame).toBeDefined();
    expect(nodesFrame?.fields.find((f) => f.name === 'mainStat')?.config).toEqual({ unit: 'r/min' });
    expect(nodesFrame?.fields.find((f) => f.name === 'secondaryStat')?.config).toEqual({ unit: 'ms/r' });
    expect(nodesFrame?.fields.find((f) => f.name === 'arc__primary')?.config).toEqual({
      color: { mode: 'fixed', fixedColor: 'red' },
    });
    expect(nodesFrame?.fields.find((f) => f.name === 'arc__Secondary')?.config).toEqual({
      color: { mode: 'fixed', fixedColor: 'yellow' },
    });
    expect(nodesFrame?.fields.find((f) => f.name === 'arc__tertiary')?.config).toEqual({
      color: { mode: 'fixed', fixedColor: '#dd40ec' },
    });

    const edgesFrame = nodeGraphFrames.find((f) => f.refId === 'edges');
    expect(edgesFrame).toBeDefined();
    expect(edgesFrame?.fields.find((f) => f.name === 'mainStat')?.config).toEqual({ unit: 'r/sec' });
    expect(edgesFrame?.fields.find((f) => f.name === 'secondaryStat')?.config).toEqual({ unit: 'ft^2' });
  });

  it('processes nodes with fixedX/Y', async () => {
    const nodesFrame = makeNodesDataFrame(3);
    nodesFrame.fields.push({
      name: NodeGraphDataFrameFieldNames.fixedX,
      type: FieldType.number,
      values: [1, 2, 3],
      config: {},
    });

    nodesFrame.fields.push({
      name: NodeGraphDataFrameFieldNames.fixedY,
      type: FieldType.number,
      values: [1, 2, 3],
      config: {},
    });
    const result = processNodes(nodesFrame, undefined);
    expect(result.hasFixedPositions).toBe(true);
    expect(result.nodes[0].x).toBe(1);
    expect(result.nodes[0].y).toBe(1);
  });

  it('throws error if fixedX/Y is used incorrectly', async () => {
    const nodesFrame = makeNodesDataFrame(3);
    nodesFrame.fields.push({
      name: NodeGraphDataFrameFieldNames.fixedX,
      type: FieldType.number,
      values: [undefined, 2, 3],
      config: {},
    });

    expect(() => processNodes(nodesFrame, undefined)).toThrow(/fixedX/);

    // We still have one undefined value in fixedX field so this should still fail
    nodesFrame.fields.push({
      name: NodeGraphDataFrameFieldNames.fixedY,
      type: FieldType.number,
      values: [1, 2, 3],
      config: {},
    });

    expect(() => processNodes(nodesFrame, undefined)).toThrow(/fixedX/);
  });
});

describe('finds connections', () => {
  it('finds connected nodes given an edge id', () => {
    const { nodes, edges } = processNodes(
      makeNodesDataFrame(3),
      makeEdgesDataFrame([
        { source: '0', target: '1' },
        { source: '0', target: '2' },
        { source: '1', target: '2' },
      ])
    );

    const linked = findConnectedNodesForEdge(nodes, edges, edges[0].id);
    expect(linked).toEqual(['0', '1']);
  });

  it('finds connected nodes given a node id', () => {
    const { nodes, edges } = processNodes(
      makeNodesDataFrame(4),
      makeEdgesDataFrame([
        { source: '0', target: '1' },
        { source: '0', target: '2' },
        { source: '1', target: '2' },
      ])
    );

    const linked = findConnectedNodesForNode(nodes, edges, nodes[0].id);
    expect(linked).toEqual(['0', '1', '2']);
  });
});

function makeNodeDatum(options: Partial<NodeDatum> = {}) {
  const colorField = {
    config: {
      color: {
        mode: 'continuous-GrYlRd',
      },
    },
    index: 7,
    name: 'color',
    type: 'number',
    values: [0.5, 0.5, 0.5],
  };

  return {
    arcSections: [
      {
        config: {
          color: {
            fixedColor: 'green',
            mode: 'fixed',
          },
        },
        name: 'arc__success',
        type: 'number',
        values: [0.5, 0.5, 0.5],
      },
      {
        config: {
          color: {
            fixedColor: 'red',
            mode: 'fixed',
          },
        },
        name: 'arc__errors',
        type: 'number',
        values: [0.5, 0.5, 0.5],
      },
    ],
    color: colorField,
    dataFrameRowIndex: 0,
    highlighted: false,
    id: '0',
    incoming: 0,
    mainStat: {
      config: {},
      index: 3,
      name: 'mainstat',
      type: 'number',
      values: [0.1, 0.1, 0.1],
    },
    secondaryStat: {
      config: {},
      index: 4,
      name: 'secondarystat',
      type: 'number',
      values: [2, 2, 2],
    },
    subTitle: 'service',
    title: 'service:0',
    icon: 'database',
    nodeRadius: {
      config: {},
      index: 9,
      name: 'noderadius',
      type: 'number',
      values: [40, 40, 40],
    },
    isInstrumented: true,
    ...options,
  };
}

function makeEdgeDatum(id: string, index: number, mainStat = '', secondaryStat = '') {
  return {
    dataFrameRowIndex: index,
    id,
    mainStat,
    secondaryStat,
    source: id.split('--')[0],
    target: id.split('--')[1],
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    highlighted: false,
    thickness: 1,
  };
}

function makeNodeFromEdgeDatum(options: Partial<NodeDatum> = {}): NodeDatum {
  return {
    arcSections: [],
    dataFrameRowIndex: 0,
    id: '0',
    incoming: 0,
    subTitle: '',
    title: 'service:0',
    ...options,
    highlighted: false,
  };
}
