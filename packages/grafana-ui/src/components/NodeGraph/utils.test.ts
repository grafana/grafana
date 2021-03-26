import { makeEdgesDataFrame, makeNodesDataFrame, processNodes } from './utils';

describe('processNodes', () => {
  it('handles empty args', async () => {
    expect(processNodes()).toEqual({ nodes: [], edges: [] });
  });

  it('returns proper nodes and edges', async () => {
    expect(
      processNodes(
        makeNodesDataFrame(3),
        makeEdgesDataFrame([
          [0, 1],
          [0, 2],
          [1, 2],
        ])
      )
    ).toEqual({
      nodes: [
        {
          arcSections: [
            {
              color: 'green',
              value: 0.5,
            },
            {
              color: 'red',
              value: 0.5,
            },
          ],
          dataFrameRowIndex: 0,
          id: '0',
          incoming: 0,
          mainStat: '0.10',
          secondaryStat: '2.00',
          subTitle: 'service',
          title: 'service:0',
        },
        {
          arcSections: [
            {
              color: 'green',
              value: 0.5,
            },
            {
              color: 'red',
              value: 0.5,
            },
          ],
          dataFrameRowIndex: 1,
          id: '1',
          incoming: 1,
          mainStat: '0.10',
          secondaryStat: '2.00',
          subTitle: 'service',
          title: 'service:1',
        },
        {
          arcSections: [
            {
              color: 'green',
              value: 0.5,
            },
            {
              color: 'red',
              value: 0.5,
            },
          ],
          dataFrameRowIndex: 2,
          id: '2',
          incoming: 2,
          mainStat: '0.10',
          secondaryStat: '2.00',
          subTitle: 'service',
          title: 'service:2',
        },
      ],
      edges: [
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
      ],
    });
  });
});
