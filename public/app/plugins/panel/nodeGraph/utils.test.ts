import { ArrayVector, createTheme } from '@grafana/data';
import { makeEdgesDataFrame, makeNodesDataFrame, processNodes } from './utils';

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
          name: 'mainStat',
          type: 'number',
          values: new ArrayVector([0.1, 0.1, 0.1]),
        },
        secondaryStat: {
          config: {},
          index: 4,
          name: 'secondaryStat',
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
          name: 'mainStat',
          type: 'number',
          values: new ArrayVector([0.1, 0.1, 0.1]),
        },
        secondaryStat: {
          config: {},
          index: 4,
          name: 'secondaryStat',
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
          name: 'mainStat',
          type: 'number',
          values: new ArrayVector([0.1, 0.1, 0.1]),
        },
        secondaryStat: {
          config: {},
          index: 4,
          name: 'secondaryStat',
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
});
