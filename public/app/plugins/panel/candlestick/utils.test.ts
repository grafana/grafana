import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import uPlot from 'uplot';

import { CandleStyle, ColorStrategy, VizDisplayMode } from './panelcfg.gen';
import { drawMarkers } from './utils';

// @ts-ignore jest-canvas-mock import fixes type errors in IDE
let unused = {} as unknown as CanvasRenderingContext2DEvent;

jest.mock('uplot', () => {
  return jest.requireActual<uPlot>('uplot');
});

describe('drawMarkers', () => {
  const height = 100;
  const width = 50;
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

  const getPlot = (data?: uPlot.AlignedData, series?: uPlot.Series[]) => {
    return new uPlot(
      {
        height,
        width,
        series:
          series ??
          ([
            { idxs: [0, 0], scale: 'x' },
            { scale: 'y/open' },
            { scale: 'y/high' },
            { scale: 'y/low' },
            { scale: 'y/close' },
          ] as uPlot.Series[]),
      },
      data ?? [
        [1000], // time
        [12], // open
        [15], // high
        [5], // low
        [10], // close
      ]
    );
  };

  describe('candle', () => {
    describe('Color strategy: OpenOpen', () => {
      it('events', () => {
        const u = getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const events = u.ctx.__getEvents();
        expect(events).toMatchSnapshot();
      });

      it('path', () => {
        const u = getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const path = u.ctx.__getPath();
        expect(path).toMatchSnapshot();
      });

      it('draw', () => {
        const u = getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const calls = u.ctx.__getDrawCalls();
        expect(calls).toMatchSnapshot();
      });

      it('clipping region', () => {
        const u = getPlot();
        expect(() => getDraw()(u)).not.toThrow();
        const clippingRegion = u.ctx.__getClippingRegion();
        expect(clippingRegion).toMatchSnapshot();
      });
    });

    describe('Color strategy: CloseClose', () => {
      it('events', () => {
        const u = getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const events = u.ctx.__getEvents();
        expect(events).toMatchSnapshot();
      });

      it('path', () => {
        const u = getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const path = u.ctx.__getPath();
        expect(path).toMatchSnapshot();
      });

      it('draw', () => {
        // HERE
        const u = getPlot();
        expect(() => getDraw({ colorStrategy: ColorStrategy.CloseClose })(u)).not.toThrow();
        const calls = u.ctx.__getDrawCalls();
        expect(calls).toMatchSnapshot();
      });

      it('clipping region', () => {
        const u = getPlot();
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
      { idxs: [0, 0], scale: 'x' },
      { scale: 'y/open' },
      { scale: 'y/high' },
      { scale: 'y/low' },
      { scale: 'y/close' },
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
    it('events', () => {
      const u = getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const events = u.ctx.__getEvents();
      expect(events).toMatchSnapshot();
    });

    it('path', () => {
      const u = getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const path = u.ctx.__getPath();
      expect(path).toMatchSnapshot();
    });

    it('draw', () => {
      const u = getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const calls = u.ctx.__getDrawCalls();
      expect(calls).toMatchSnapshot();
    });

    it('clipping region', () => {
      const u = getPlot(volumeAlignedData, volumeSeries);
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
    it('events', () => {
      const u = getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const events = u.ctx.__getEvents();
      expect(events).toMatchSnapshot();
    });

    it('path', () => {
      const u = getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const path = u.ctx.__getPath();
      expect(path).toMatchSnapshot();
    });

    it('draw', () => {
      const u = getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const calls = u.ctx.__getDrawCalls();
      expect(calls).toMatchSnapshot();
    });

    it('clipping region', () => {
      const u = getPlot(volumeAlignedData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      const clippingRegion = u.ctx.__getClippingRegion();
      expect(clippingRegion).toMatchSnapshot();
    });
  });
});
