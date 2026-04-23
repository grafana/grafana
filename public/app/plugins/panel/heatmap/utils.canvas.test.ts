import { waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import uPlot, { type AlignedData } from 'uplot';

import { heatmapPathsDense } from './utils';

/** Dense heatmap data: 2 columns × 3 rows (same fixture as utils.test.ts). */
const denseHeatmapData: AlignedData = [
  null,
  [
    [1, 1, 2, 2, 3, 3, 5, 5, 6, 6],
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [8, 12, 6, 13, 7, 9, 9, 7, 5, 9],
  ],
  [[], []],
];

describe('heatmapPathsDense', () => {
  const height = 400;
  const width = 800;

  const drawDense = heatmapPathsDense({
    each: () => {},
    gap: 1,
    disp: {
      fill: {
        values: () => [0, 1, 2, 0, 1, 2],
        index: ['#aa0000', '#00aa00', '#0000aa'],
      },
    },
  });

  const getPlot = async (): Promise<{ u: uPlot; uPlotEvents: CanvasRenderingContext2DEvent[] }> => {
    const u = new uPlot(
      {
        mode: 2,
        height,
        width,
        axes: [
          {
            scale: 'x',
            show: true,
            stroke: 'rgb(204, 204, 220)',
            side: 2,
            font: "12px 'Inter', 'Helvetica', 'Arial', sans-serif",
            gap: 5,
            labelGap: 0,
            grid: {
              show: true,
              stroke: 'rgba(240, 250, 255, 0.09)',
              width: 0.5,
            },
            ticks: {
              show: true,
              stroke: 'rgba(240, 250, 255, 0.09)',
              width: 0.5,
              size: 4,
            },
            incrs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
          {
            scale: 'y_knz1rg',
            show: true,
            stroke: 'rgb(204, 204, 220)',
            side: 3,
            font: "12px 'Inter', 'Helvetica', 'Arial', sans-serif",
            gap: 5,
            labelGap: 0,
            grid: {
              show: true,
              stroke: 'rgba(240, 250, 255, 0.09)',
              width: 0.5,
            },
            ticks: {
              show: true,
              stroke: 'rgba(240, 250, 255, 0.09)',
              width: 0.5,
              size: 4,
            },
          },
        ],
        scales: {
          x: {
            time: false,
            auto: true,
            dir: 1,
            ori: 0,
            distr: 1,
          },
          y_knz1rg: {
            time: false,
            auto: true,
            dir: 1,
            ori: 1,
            distr: 1,
          },
        },
        series: [
          null,
          {
            scale: '',
            facets: [
              {
                scale: 'x',
                auto: true,
                sorted: 1,
              },
              {
                scale: 'y_knz1rg',
                auto: true,
              },
            ],
            show: true,
            stroke: '#808080',
            points: {
              stroke: '#808080',
              fill: '#808080',
            },
          },
          {
            scale: '',
            facets: [
              {
                scale: 'x',
                auto: true,
                sorted: 1,
              },
              {
                scale: 'y_knz1rg',
                auto: true,
              },
            ],
            show: true,
            stroke: '#808080',
            points: {
              stroke: '#808080',
              fill: '#808080',
            },
          },
        ] as uPlot.Series[],
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

  it.each([['events', (plot: uPlot) => plot.ctx.__getEvents()]] satisfies Array<
    [string, (plot: uPlot) => CanvasRenderingContext2DEvent[]]
  >)('%s', async (_, setup) => {
    const { u, uPlotEvents } = await getPlot();
    expect(() => drawDense(u, 1)).not.toThrow();
    expect(scrubOutput(setup(u))).toMatchUPlotSnapshot(uPlotEvents, { width, height });
  });
});
