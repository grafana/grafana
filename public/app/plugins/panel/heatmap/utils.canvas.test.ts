import { waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import uPlot, { type AlignedData } from 'uplot';

import { heatmapPathsDense } from './utils';

const denseHeatmapData: AlignedData = [
  null,
  [
    [1, 1, 2, 2, 3, 3, 5, 5, 6, 6],
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [8, 12, 6, 13, 7, 9, 9, 7, 5, 9],
  ],
  [[], []],
] as unknown as AlignedData;

const canvasPattern64 = [
  '#7f2704',
  '#842904',
  '#892b04',
  '#8e2d04',
  '#932f03',
  '#983103',
  '#9e3303',
  '#a33503',
  '#a93703',
  '#af3903',
  '#b43b02',
  '#ba3d02',
  '#c04002',
  '#c64203',
  '#cc4503',
  '#d14804',
  '#d64b05',
  '#da4f06',
  '#de5207',
  '#e25609',
  '#e55a0c',
  '#e85e0e',
  '#eb6211',
  '#ee6715',
  '#f06b18',
  '#f2701c',
  '#f47421',
  '#f67825',
  '#f77d2a',
  '#f8812f',
  '#fa8635',
  '#fb8a3a',
  '#fb8f40',
  '#fc9345',
  '#fc974b',
  '#fd9c51',
  '#fda057',
  '#fda45d',
  '#fda864',
  '#fdad6a',
  '#fdb170',
  '#fdb577',
  '#fdb97e',
  '#fdbd84',
  '#fdc28b',
  '#fdc692',
  '#fdc998',
  '#fdcd9f',
  '#fdd1a5',
  '#fdd4ab',
  '#fdd7b1',
  '#fedab6',
  '#feddbc',
  '#fee0c1',
  '#fee2c6',
  '#fee5cb',
  '#fee7cf',
  '#fee9d4',
  '#feebd8',
  '#feeddc',
  '#ffefe0',
  '#fff1e4',
  '#fff3e7',
  '#fff5eb',
];

describe('heatmapPathsDense', () => {
  const height = 378;
  const width = 648;

  const drawDense = heatmapPathsDense({
    each: () => {},
    gap: 1,
    disp: {
      fill: {
        values: () => [24, 56, 8, 63, 16, 32, 32, 16, 0, 32],
        index: canvasPattern64,
      },
    },
  });

  const getPlot = async (): Promise<{ u: uPlot; uPlotEvents: CanvasRenderingContext2DEvent[] }> => {
    const u = new uPlot(
      {
        mode: 2,
        series: [{}, { facets: [{ scale: 'x' }, { scale: 'y2' }] }, { facets: [{ scale: 'x' }, { scale: 'y2' }] }],
        axes: [{ scale: 'x' }, { scale: 'y2' }],
        scales: {
          x: { time: false, min: 0.5, max: 6.5 },
          y: { time: false },
          y2: { time: false, min: -0.5, max: 1.51 },
        },
        padding: [8, 8, 0, 0],
        width,
        height,
      },
      denseHeatmapData
    );

    await waitFor(() => expect(u.status).toBe(1));

    const uPlotEvents = u.ctx.__getEvents();
    u.ctx.__clearDrawCalls();
    u.ctx.__clearEvents();
    u.ctx.__clearPath();

    return { u, uPlotEvents };
  };

  function scrubOutput(
    events: CanvasRenderingContext2DEvent[]
  ): Array<Omit<CanvasRenderingContext2DEvent, 'transform'>> {
    return events.map(({ transform, ...event }) =>
      event.props.path ? { ...event, props: { ...event.props, path: scrubOutput(event.props.path) } } : event
    );
  }

  it('should draw dense heatmap', async () => {
    const { u, uPlotEvents } = await getPlot();
    expect(() => drawDense(u, 1)).not.toThrow();
    expect(scrubOutput(u.ctx.__getEvents())).toMatchUPlotSnapshot(uPlotEvents, { width, height });
  });
});
