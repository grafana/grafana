import { DataFrame, FieldType, createDataFrame } from '@grafana/data';

import { Options as NodeGraphOptions } from './panelcfg.gen';
import { getNodeGraphDataFrames } from './utils';

describe('getNodeGraphDataFrames', () => {
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

  it('interpolates panel options correctly', () => {
    const frames = [
      createDataFrame({
        refId: 'nodes',
        fields: [
          { name: 'id', type: FieldType.string },
          { name: 'mainStat', type: FieldType.string },
          { name: 'secondaryStat', type: FieldType.string },
          { name: 'arc__primary', type: FieldType.string },
          { name: 'arc__secondary', type: FieldType.string },
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
          { field: 'arc__secondary', color: 'yellow' },
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
    expect(nodesFrame?.fields.find((f) => f.name === 'arc__secondary')?.config).toEqual({
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
});
