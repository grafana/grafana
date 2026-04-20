import { waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import uPlot, { type AlignedData } from 'uplot';

import { CandleStyle, ColorStrategy, VizDisplayMode } from './panelcfg.gen';
import { drawMarkers } from './utils';

/**
 * Since this method only has outputs in the canvas, I'm not sure how it can be tested otherwise without mocks that are probably more wedded to implementation
 * TL;DR if this test is failing after updating uPlot, delete the __snapshot__/utils.test.ts.snap and re-run the tests and commit the output
 * If this test is failing after making changes to drawMarkers, verify that you intended to change the canvas and then do the same.
 *
 * @todo replace with screenshot regression testing
 */

type DrawOverrides = Partial<Parameters<typeof drawMarkers>[0]>;
type TestCase = [string, DrawOverrides?, uPlot.AlignedData?, uPlot.Series[]?];

describe('drawMarkers', () => {
  const height = 400;
  const width = 800;
  const upColor = '#00ff00';
  const downColor = '#ff0000';
  const flatColor = '#888888';

  const getDraw = (overrides?: Partial<Parameters<typeof drawMarkers>[0]>) =>
    drawMarkers({
      mode: VizDisplayMode.Candles,
      candleStyle: CandleStyle.Candles,
      colorStrategy: ColorStrategy.OpenClose,
      fields: { open: 1, high: 2, low: 3, close: 4 },
      upColor,
      downColor,
      flatColor,
      volumeAlpha: 0.5,
      flatAsUp: true,
      ...overrides,
    });

  const getPlot = async (data?: uPlot.AlignedData, series?: uPlot.Series[]) => {
    const u = new uPlot(
      {
        height,
        width,
        series:
          series ??
          ([
            {},
            { scale: 'y' }, // open
            { scale: 'y' }, // high
            { scale: 'y' }, // low
            { scale: 'y' }, // close
          ] as uPlot.Series[]),
      },
      data ?? [
        [1000, 2000], // time
        [5, 10], // open
        [50, 100], // high
        [4, 8], // low
        [15, 30], // close
      ]
    );

    // uPlot does some async work after construction, let's wait until that is complete
    await waitFor(() => expect(u.status).toBe(1));

    // Clear out uPlot scaffolding canvas changes, we'll only assert on the changes introduced from invoking `drawMarkers`
    u.ctx.__clearDrawCalls();
    u.ctx.__clearEvents();
    u.ctx.__clearPath();

    return u;
  };

  function scrubOutput(
    events: CanvasRenderingContext2DEvent[]
  ): Array<Omit<CanvasRenderingContext2DEvent, 'transform'>> {
    // pull out the duplicated identity matrix
    return events.map(({ transform, ...event }) =>
      event.props.path ? { ...event, props: { ...event.props, path: scrubOutput(event.props.path) } } : event
    );
  }

  describe('options', () => {
    describe.each([
      ['Color strategy: OpenClose', { colorStrategy: ColorStrategy.OpenClose }],
      ['Color strategy: CloseClose', { colorStrategy: ColorStrategy.CloseClose }],
      ['Candle Style: CandleStyle.OHLCBars', { candleStyle: CandleStyle.OHLCBars }],
    ] satisfies TestCase[])(
      '%s',
      (_describeName, drawOverrides?: DrawOverrides, dataOverrides?: AlignedData, seriesOverrides?: uPlot.Series[]) => {
        it.each([
          ['events', (u) => u.ctx.__getEvents()],
          ['path', (u) => u.ctx.__getPath()],
          ['draw', (u) => u.ctx.__getDrawCalls()],
          ['clipping region', (u) => u.ctx.__getClippingRegion()],
        ] satisfies Array<[string, (u: uPlot) => unknown]>)('%s', async (testName, setup) => {
          const u = await getPlot(dataOverrides, seriesOverrides);
          expect(() => getDraw(drawOverrides)(u)).not.toThrow();
          if (testName === 'clipping region') {
            expect(setup(u)).toEqual([]);
          } else {
            expect(scrubOutput(setup(u))).toMatchSnapshot();
          }
        });
      }
    );
  });

  describe('candle with volume', () => {
    const volumeAlignedData: uPlot.AlignedData = [
      [1000, 2000], // time
      [10, 11], // open
      [15, 16], // high
      [5, 6], // low
      [12, 13], // close
      [150000, 200000], // volume
    ];
    const volumeSeries: uPlot.Series[] = [
      { scale: 'x' },
      { scale: 'y' },
      { scale: 'y' },
      { scale: 'y' },
      { scale: 'y' },
      { scale: 'y' },
    ];
    const volumeOpts: Parameters<typeof drawMarkers>[0] = {
      mode: VizDisplayMode.CandlesVolume,
      candleStyle: CandleStyle.Candles,
      colorStrategy: ColorStrategy.OpenClose,
      fields: { open: 1, high: 2, low: 3, close: 4, volume: 5 },
      upColor,
      downColor,
      flatColor,
      volumeAlpha: 0.5,
      flatAsUp: true,
    };

    it.each([
      ['events', (u) => u.ctx.__getEvents()],
      ['path', (u) => u.ctx.__getPath()],
      ['draw', (u) => u.ctx.__getDrawCalls()],
      ['clipping region', (u) => u.ctx.__getClippingRegion()],
    ] satisfies Array<[string, (u: uPlot) => unknown]>)('%s', async (testName, setup) => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      if (testName === 'clipping region') {
        expect(setup(u)).toEqual([]);
      } else {
        expect(scrubOutput(setup(u))).toMatchSnapshot();
      }
    });
  });

  describe('candle with volume & regions', () => {
    const volumeAlignedData: uPlot.AlignedData = [
      [1000, 2000], // time
      [10, 11], // open
      [15, 16], // high
      [5, 6], // low
      [12, 13], // close
      [150000, 200000], // volume
    ];
    const volumeSeries: uPlot.Series[] = [
      { idxs: [0, 0], scale: 'x' },
      { scale: 'y' },
      { scale: 'y' },
      { scale: 'y' },
      { scale: 'y' },
      { scale: 'y/volume' },
    ];
    const volumeOpts: Parameters<typeof drawMarkers>[0] = {
      mode: VizDisplayMode.CandlesVolume,
      candleStyle: CandleStyle.Candles,
      colorStrategy: ColorStrategy.OpenClose,
      fields: { open: 1, high: 2, low: 3, close: 4, volume: 5 },
      upColor,
      downColor,
      flatColor,
      volumeAlpha: 0.5,
      flatAsUp: true,
    };
    it.each([
      ['events', (u) => u.ctx.__getEvents()],
      ['path', (u) => u.ctx.__getPath()],
      ['draw', (u) => u.ctx.__getDrawCalls()],
      ['clipping region', (u) => u.ctx.__getClippingRegion()],
    ] satisfies Array<[string, (u: uPlot) => unknown]>)('%s', async (testName, setup) => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      if (testName === 'clipping region') {
        expect(setup(u)).toEqual([]);
      } else {
        expect(scrubOutput(setup(u))).toMatchSnapshot();
      }
    });
  });
});
