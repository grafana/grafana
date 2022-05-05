import { ArrayVector, createTheme, DataFrame, FieldType, MutableDataFrame } from '@grafana/data';

import {
  getEdgeFields,
  getNodeFields,
  getNodeGraphDataFrames,
  makeEdgesDataFrame,
  makeNodesDataFrame,
  processNodes,
} from './utils';

describe('processNodes', () => {
  const theme = createTheme();

  it('handles empty args', async () => {
    expect(processNodes(undefined, undefined, theme)).toEqual({ nodes: [], edges: [] });
  });

  it('returns proper nodes and edges', async () => {
    const { nodes, edges, legend } = processNodes(
      makeNodesDataFrame(3),
      makeEdgesDataFrame([
        [0, 1],
        [0, 2],
        [1, 2],
      ]),
      theme
    );

    const colorField = {
      config: {
        color: {
          mode: 'continuous-GrYlRd',
        },
      },
      index: 7,
      name: 'color',
      type: 'number',
      values: new ArrayVector([0.5, 0.5, 0.5]),
    };

    expect(nodes).toEqual([
      {
        arcSections: [
          {
            config: {
              color: {
                fixedColor: 'green',
              },
            },
            name: 'arc__success',
            type: 'number',
            values: new ArrayVector([0.5, 0.5, 0.5]),
          },
          {
            config: {
              color: {
                fixedColor: 'red',
              },
            },
            name: 'arc__errors',
            type: 'number',
            values: new ArrayVector([0.5, 0.5, 0.5]),
          },
        ],
        color: colorField,
        dataFrameRowIndex: 0,
        id: '0',
        incoming: 0,
        mainStat: {
          config: {},
          index: 3,
          name: 'mainstat',
          type: 'number',
          values: new ArrayVector([0.1, 0.1, 0.1]),
        },
        secondaryStat: {
          config: {},
          index: 4,
          name: 'secondarystat',
          type: 'number',
          values: new ArrayVector([2, 2, 2]),
        },
        subTitle: 'service',
        title: 'service:0',
      },
      {
        arcSections: [
          {
            config: {
              color: {
                fixedColor: 'green',
              },
            },
            name: 'arc__success',
            type: 'number',
            values: new ArrayVector([0.5, 0.5, 0.5]),
          },
          {
            config: {
              color: {
                fixedColor: 'red',
              },
            },
            name: 'arc__errors',
            type: 'number',
            values: new ArrayVector([0.5, 0.5, 0.5]),
          },
        ],
        color: colorField,
        dataFrameRowIndex: 1,
        id: '1',
        incoming: 1,
        mainStat: {
          config: {},
          index: 3,
          name: 'mainstat',
          type: 'number',
          values: new ArrayVector([0.1, 0.1, 0.1]),
        },
        secondaryStat: {
          config: {},
          index: 4,
          name: 'secondarystat',
          type: 'number',
          values: new ArrayVector([2, 2, 2]),
        },
        subTitle: 'service',
        title: 'service:1',
      },
      {
        arcSections: [
          {
            config: {
              color: {
                fixedColor: 'green',
              },
            },
            name: 'arc__success',
            type: 'number',
            values: new ArrayVector([0.5, 0.5, 0.5]),
          },
          {
            config: {
              color: {
                fixedColor: 'red',
              },
            },
            name: 'arc__errors',
            type: 'number',
            values: new ArrayVector([0.5, 0.5, 0.5]),
          },
        ],
        color: colorField,
        dataFrameRowIndex: 2,
        id: '2',
        incoming: 2,
        mainStat: {
          config: {},
          index: 3,
          name: 'mainstat',
          type: 'number',
          values: new ArrayVector([0.1, 0.1, 0.1]),
        },
        secondaryStat: {
          config: {},
          index: 4,
          name: 'secondarystat',
          type: 'number',
          values: new ArrayVector([2, 2, 2]),
        },
        subTitle: 'service',
        title: 'service:2',
      },
    ]);

    expect(edges).toEqual([
      {
        dataFrameRowIndex: 0,
        id: '0--1',
        mainStat: '',
        secondaryStat: '',
        source: '0',
        target: '1',
      },
      {
        dataFrameRowIndex: 1,
        id: '0--2',
        mainStat: '',
        secondaryStat: '',
        source: '0',
        target: '2',
      },
      {
        dataFrameRowIndex: 2,
        id: '1--2',
        mainStat: '',
        secondaryStat: '',
        source: '1',
        target: '2',
      },
    ]);

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

  it('detects dataframes correctly', () => {
    const validFrames = [
      new MutableDataFrame({
        refId: 'hasPreferredVisualisationType',
        fields: [],
        meta: {
          preferredVisualisationType: 'nodeGraph',
        },
      }),
      new MutableDataFrame({
        refId: 'hasName',
        fields: [],
        name: 'nodes',
      }),
      new MutableDataFrame({
        refId: 'nodes', // hasRefId
        fields: [],
      }),
      new MutableDataFrame({
        refId: 'hasValidNodesShape',
        fields: [{ name: 'id', type: FieldType.string }],
      }),
      new MutableDataFrame({
        refId: 'hasValidEdgesShape',
        fields: [
          { name: 'id', type: FieldType.string },
          { name: 'source', type: FieldType.string },
          { name: 'target', type: FieldType.string },
        ],
      }),
    ];
    const invalidFrames = [
      new MutableDataFrame({
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
    const nodeFrame = new MutableDataFrame({
      refId: 'nodes',
      fields: [
        { name: 'id', type: FieldType.string, values: ['id'] },
        { name: 'title', type: FieldType.string, values: ['title'] },
        { name: 'SUBTITLE', type: FieldType.string, values: ['subTitle'] },
        { name: 'mainstat', type: FieldType.string, values: ['mainStat'] },
        { name: 'seconDarysTat', type: FieldType.string, values: ['secondaryStat'] },
      ],
    });

    const nodeFields = getNodeFields(nodeFrame);
    expect(nodeFields.id).toBeDefined();
    expect(nodeFields.title).toBeDefined();
    expect(nodeFields.subTitle).toBeDefined();
    expect(nodeFields.mainStat).toBeDefined();
    expect(nodeFields.secondaryStat).toBeDefined();

    const edgeFrame = new MutableDataFrame({
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
});
