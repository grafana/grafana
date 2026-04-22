import { waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import uPlot, { type AlignedData } from 'uplot';

import { CandleStyle, ColorStrategy, VizDisplayMode } from './panelcfg.gen';
import { drawMarkers } from './utils';

type DrawOverrides = Partial<Parameters<typeof drawMarkers>[0]>;
type TestCase = [string, DrawOverrides?, uPlot.AlignedData?, uPlot.Series[]?];

// 0.19986,0.20009,0.19983,0.20004,286630.4,0.1999668,0.2002845,0.1996492
// 0.20007,0.20007,0.19987,0.19987,159971.9,0.1999771,0.2002826,0.1996717
// 0.20007,0.20007,0.19981,0.19982,275794.6,0.1999793,0.2002794,0.1996792
// 0.19982,0.19993,0.19982,0.19989,69022.6,0.1999803,0.2002763,0.1996842
// 0.19982,0.19993,0.19982,0.19983,99248,0.1999779,0.2002784,0.1996775
// 0.19983,0.19983,0.19978,0.19979,172760.1,0.1999729,0.2002815,0.1996642
// 0.19983,0.19983,0.19973,0.19974,279206.1,0.1999568,0.2002748,0.1996389
// 0.19976,0.19979,0.19971,0.19971,26255.9,0.1999368,0.2002544,0.1996192
// 0.19976,0.19979,0.19968,0.19968,125773.9,0.1999116,0.2002202,0.1996029
// 0.19968,0.19968,0.19952,0.19959,110251.6,0.1998719,0.2001495,0.1995943

// from ohlc_dogecoin.csv
// const defaultData: AlignedData = [
//   [1000, 2000], // time
//   [0.19986, 0.20007, 0.20007, 0.19982, 0.19982, 0.19983, 0.19983, 0.19976, 0.19976, 0.19968], // open
//   [0.20009, 0.20007, 0.20007, 0.19993, 0.19993, 0.19983, 0.19983, 0.19979, 0.19979, 0.19968], // high
//   [0.19983,
//     0.19987,
//     0.19981,
//     0.19982,
//     0.19982,
//     0.19978,
//     0.19973,
//     0.19971,
//     0.19968,
//     0.19952,], // low
//   [0.20004, 0.19987], // close
//   [286630.4, 159971.9], // volume
//   // [0.1999668, 0.1999771], // volume?
//   // [0.2002845, 0.2002826],  // volume?
//   // [0.1996492, 0.1996717],  // volume?
// ];
//

// from ohlc_dogecoin.csv
const defaultData: AlignedData = [
  [1000, 2000], // time
  [0.19986, 0.20007], // open
  [0.20009, 0.20007], // high
  [0.19983, 0.19987], // low
  [0.20004, 0.19987], // close
  [286630.4, 159971.9], // volume
  // [0.1999668, 0.1999771], // volume?
  // [0.2002845, 0.2002826],  // volume?
  // [0.1996492, 0.1996717],  // volume?
];

const defaultSeries: uPlot.Series[] = [
  {},
  { scale: 'y' }, // open
  { scale: 'y' }, // high
  { scale: 'y' }, // low
  { scale: 'y' }, // close
];

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

  const getPlot = async (data: uPlot.AlignedData, series: uPlot.Series[] = defaultSeries): Promise<{ u: uPlot }> => {
    const u = new uPlot(
      {
        height,
        width,
        series: series ?? defaultSeries,
      },
      data
    );

    // uPlot does some async work after construction, let's wait until that is complete
    await waitFor(() => expect(u.status).toBe(1));

    // Clear out uPlot scaffolding canvas changes, we'll only assert on the changes introduced from invoking `drawMarkers`
    // u.ctx.__clearDrawCalls();
    u.ctx.__clearEvents();
    u.ctx.__clearPath();

    return { u };
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
          const { u } = await getPlot(dataOverrides ?? defaultData, seriesOverrides);
          expect(() => getDraw(drawOverrides)(u)).not.toThrow();
          if (testName === 'clipping region') {
            expect(setup(u)).toEqual([]);
          } else {
            expect(scrubOutput(setup(u))).toMatchUPlotSnapshot(
              dataOverrides ?? defaultData,
              seriesOverrides ?? defaultSeries
            );
          }
        });
      }
    );
  });

  describe('candle with volume', () => {
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
      const { u } = await getPlot(defaultData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      if (testName === 'clipping region') {
        expect(setup(u)).toEqual([]);
      } else {
        expect(scrubOutput(setup(u))).toMatchUPlotSnapshot(defaultData, volumeSeries);
      }
    });
  });

  describe('candle with volume & regions', () => {
    const volumeSeries: uPlot.Series[] = [
      { scale: 'x' },
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
      const { u } = await getPlot(defaultData, volumeSeries);
      expect(() => getDraw(volumeOpts)(u)).not.toThrow();
      if (testName === 'clipping region') {
        expect(setup(u)).toEqual([]);
      } else {
        expect(scrubOutput(setup(u))).toMatchUPlotSnapshot(defaultData, volumeSeries);
      }
    });
  });
});
