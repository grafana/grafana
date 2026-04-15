import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import uPlot from 'uplot';

import { CandleStyle, ColorStrategy, VizDisplayMode } from './panelcfg.gen';
import { drawMarkers } from './utils';

// @ts-ignore jest-canvas-mock import fixes type errors in IDE
let unused = {} as unknown as CanvasRenderingContext2DEvent;

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

    return u;
  };

  describe('candle', () => {
    describe('Color strategy: OpenOpen', () => {
      it('events', async () => {
        const u = await getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const events = u.ctx.__getEvents();
        expect(events).toMatchSnapshot();
      });

      it('path', async () => {
        const u = await getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const path = u.ctx.__getPath();
        expect(path).toMatchSnapshot();
      });

      it('draw', async () => {
        const u = await getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const calls = u.ctx.__getDrawCalls();
        expect(calls).toMatchSnapshot();
      });

      it('clipping region', async () => {
        const u = await getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const clippingRegion = u.ctx.__getClippingRegion();
        expect(clippingRegion).toMatchSnapshot();
      });
    });

    describe('Color strategy: CloseClose', () => {
      it('events', async () => {
        const u = await getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const events = u.ctx.__getEvents();
        expect(events).toMatchSnapshot();
      });

      it('path', async () => {
        const u = await getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const path = u.ctx.__getPath();
        expect(path).toMatchSnapshot();
      });

      it('draw', async () => {
        // HERE
        const u = await getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const calls = u.ctx.__getDrawCalls();
        expect(calls).toMatchSnapshot();
      });

      it('clipping region', async () => {
        const u = await getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const clippingRegion = u.ctx.__getClippingRegion();
        expect(clippingRegion).toMatchSnapshot();
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
      expect(events).toMatchSnapshot();
    });

    it('path', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const path = u.ctx.__getPath();
      expect(path).toMatchSnapshot();
    });

    it('draw', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const calls = u.ctx.__getDrawCalls();
      expect(calls).toMatchSnapshot();
    });

    it('clipping region', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const clippingRegion = u.ctx.__getClippingRegion();
      expect(clippingRegion).toMatchSnapshot();
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
      expect(events).toMatchSnapshot();
    });

    it('path', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const path = u.ctx.__getPath();
      expect(path).toMatchSnapshot();
    });

    it('draw', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const calls = u.ctx.__getDrawCalls();
      expect(calls).toMatchSnapshot();
    });

    it('clipping region', async () => {
      const u = await getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const clippingRegion = u.ctx.__getClippingRegion();
      expect(clippingRegion).toMatchSnapshot();
    });
  });
});
