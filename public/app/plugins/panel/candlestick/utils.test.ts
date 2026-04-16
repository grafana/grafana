import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import uPlot from 'uplot';

import { CandleStyle, ColorStrategy, VizDisplayMode } from './panelcfg.gen';
import { drawMarkers } from './utils';

// @ts-ignore jest-canvas-mock import fixes type errors in IDE
let unused = {} as unknown as CanvasRenderingContext2DEvent;

/**
 * These snapshot tests might need to be updated whenever uPlot is updated if that impacts how the candlestick panel is drawn in the canvas,
 * but should be good at catching unintentional regression in the drawMarkers method.
 * Since this method only has outputs in the canvas, I'm not sure how it can be tested otherwise without mocks that are probably more wedded to implementation
 * TL;DR if this test is failing after updating uPlot, delete the __snapshot__/utils.test.ts.snap and re-run the tests and commit the output
 * If this test is failing after making changes to drawMarkers, verify that you intended to change the canvas and then do the same.
 *
 * @todo replace with screenshot regression testing
 */
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
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Clear out uPlot scaffolding canvas changes, we'll only assert on the changes introduced from invoking `drawMarkers`
    u.ctx.__clearDrawCalls();
    u.ctx.__clearEvents();
    u.ctx.__clearPath();

    return u;
  };

  describe('options', () => {
    describe('Color strategy: OpenOpen', () => {
      it('events', async () => {
        const u = await getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const events = u.ctx.__getEvents();
        expect(events.length).toBeGreaterThan(0);
        expect(events).toMatchSnapshot();
      });

      it('path', async () => {
        const u = await getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const path = u.ctx.__getPath();
        expect(path.length).toBeGreaterThan(0);
        expect(path).toMatchSnapshot();
      });

      it('draw', async () => {
        const u = await getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const calls = u.ctx.__getDrawCalls();
        expect(calls.length).toBeGreaterThan(0);
        expect(calls).toMatchSnapshot();
      });

      it('clipping region', async () => {
        const u = await getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const clippingRegion = u.ctx.__getClippingRegion();
        expect(clippingRegion).toEqual([]);
      });
    });

    describe('Color strategy: CloseClose', () => {
      it('events', async () => {
        const u = await getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const events = u.ctx.__getEvents();
        expect(events.length).toBeGreaterThan(0);
        expect(events).toMatchSnapshot();
      });

      it('path', async () => {
        const u = await getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const path = u.ctx.__getPath();
        expect(path.length).toBeGreaterThan(0);
        expect(path).toMatchSnapshot();
      });

      it('draw', async () => {
        const u = await getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const calls = u.ctx.__getDrawCalls();
        expect(calls.length).toBeGreaterThan(0);
        expect(calls).toMatchSnapshot();
      });

      it('clipping region', async () => {
        const u = await getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const clippingRegion = u.ctx.__getClippingRegion();
        expect(clippingRegion).toEqual([]);
      });
    });

    describe('Candle Style: CandleStyle.OHLCBars', () => {
      it('events', async () => {
        const u = await getPlot();
        expect(() => getDraw({ candleStyle: CandleStyle.OHLCBars })(u)).not.toThrow();
        const events = u.ctx.__getEvents();
        expect(events.length).toBeGreaterThan(0);
        expect(events).toMatchSnapshot();
      });

      it('path', async () => {
        const u = await getPlot();
        expect(() => getDraw({ candleStyle: CandleStyle.OHLCBars })(u)).not.toThrow();
        const path = u.ctx.__getPath();
        expect(path.length).toBeGreaterThan(0);
        expect(path).toMatchSnapshot();
      });

      it('draw', async () => {
        const u = await getPlot();
        expect(() => getDraw({ candleStyle: CandleStyle.OHLCBars })(u)).not.toThrow();
        const calls = u.ctx.__getDrawCalls();
        expect(calls.length).toBeGreaterThan(0);
        expect(calls).toMatchSnapshot();
      });

      it('clipping region', async () => {
        const u = await getPlot();
        expect(() => getDraw({ candleStyle: CandleStyle.OHLCBars })(u)).not.toThrow();
        const clippingRegion = u.ctx.__getClippingRegion();
        expect(clippingRegion).toEqual([]);
      });
    });
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
    it('events', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const events = u.ctx.__getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events).toMatchSnapshot();
    });

    it('path', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const path = u.ctx.__getPath();
      expect(path.length).toBeGreaterThan(0);
      expect(path).toMatchSnapshot();
    });

    it('draw', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const calls = u.ctx.__getDrawCalls();
      expect(calls.length).toBeGreaterThan(0);
      expect(calls).toMatchSnapshot();
    });

    it('clipping region', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const clippingRegion = u.ctx.__getClippingRegion();
      expect(clippingRegion).toEqual([]);
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
      [0.19, 0.2], // sma
      [0.3, 0.29], // bolup
      [0.5, 0.39], // boldown
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
    it('events', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const events = u.ctx.__getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events).toMatchSnapshot();
    });

    it('path', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const path = u.ctx.__getPath();
      expect(path.length).toBeGreaterThan(0);
      expect(path).toMatchSnapshot();
    });

    it('draw', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const calls = u.ctx.__getDrawCalls();
      expect(calls.length).toBeGreaterThan(0);
      expect(calls).toMatchSnapshot();
    });

    it('clipping region', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const clippingRegion = u.ctx.__getClippingRegion();
      expect(clippingRegion).toEqual([]);
    });
  });
});
