import { waitFor } from '@testing-library/react';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import uPlot, { type AlignedData } from 'uplot';

import { CandleStyle, ColorStrategy, VizDisplayMode } from './panelcfg.gen';
import { drawMarkers } from './utils';

type DrawOverrides = Partial<Parameters<typeof drawMarkers>[0]>;
type TestCase = [string, DrawOverrides?, uPlot.AlignedData?, uPlot.Series[]?];

// from ohlc_dogecoin.csv
const defaultData: AlignedData = [
  [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 11000], // time
  [0.19986, 0.20007, 0.20007, 0.19982, 0.19982, 0.19983, 0.19983, 0.19976, 0.19976, 0.19968], // open
  [0.20009, 0.20007, 0.20007, 0.19993, 0.19993, 0.19983, 0.19983, 0.19979, 0.19979, 0.19968], // high
  [0.19983, 0.19987, 0.19981, 0.19982, 0.19982, 0.19978, 0.19973, 0.19971, 0.19968, 0.19952], // low
  [0.20004, 0.19987, 0.19982, 0.19989, 0.19983, 0.19979, 0.19974, 0.19971, 0.19968, 0.19959], // close
  [286630.4, 159971.9, 275794.6, 69022.6, 99248, 0, 172760.1, 279206.1, 26255.9, 125773.9, 110251.6], // volume
  // Only used in the time series panel, not touched in canvas draw in utils.ts
  [0.1999668, 0.1999771, 0.1999793, 0.1999803, 0.1999779, 0.1999729, 0.1999568, 0.1999368, 0.1999116, 0.1998719], // sma (simple moving average)
  [0.2002845, 0.2002826, 0.2002794, 0.2002763, 0.2002784, 0.2002815, 0.2002748, 0.2002544, 0.2002202, 0.2001495], // bolup (Upper Bollinger band)
  [0.1996492, 0.1996717, 0.1996792, 0.1996842, 0.1996775, 0.1996642, 0.1996389, 0.1996192, 0.1996029, 0.1995943], // boldn Lower Bollinger band
];

const defaultSeries: uPlot.Series[] = [
  { scale: 'x' }, // time
  { scale: 'y' }, // open
  { scale: 'y' }, // high
  { scale: 'y' }, // low
  { scale: 'y' }, // close
];

const volumeSeries: uPlot.Series[] = [
  { scale: 'x' }, // time
  { scale: 'y' }, // open
  { scale: 'y' }, // high
  { scale: 'y' }, // low
  { scale: 'y' }, // close
  { scale: 'y' }, // volume
];

describe('drawMarkers', () => {
  const height = 400;
  const width = 800;
  const upColor = '#73BF69';
  const downColor = '#F2495C';
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

  /** Y-axis tick labels: default uPlot would round to ~1 decimal, hiding OHLC resolution in the mock view. */
  const yAxisValues4Decimals: uPlot.Axis.Values = (_u, splits) => splits.map((v) => v.toFixed(4));

  /** Wider gutter so 4-decimal tick strings are not clipped (uPlot `Axis.size` = y axis width in CSS px). */
  const yAxisGutterWidthPx = 100;

  const getPlot = async (
    data: uPlot.AlignedData,
    series: uPlot.Series[] = defaultSeries
  ): Promise<{ testEvents: uPlot; uPlotEvents: CanvasRenderingContext2DEvent[] }> => {
    const testEvents = new uPlot(
      {
        height,
        width,
        series: series ?? defaultSeries,
        // [x, y] — use custom numeric formatting on the y scale (see uPlot `Axis.values`)
        axes: [{}, { scale: 'y', size: yAxisGutterWidthPx, values: yAxisValues4Decimals }],
      },
      data
    );

    // uPlot does some async work after construction, let's wait until that is complete
    await waitFor(() => expect(testEvents.status).toBe(1));

    const uPlotEvents = testEvents.ctx.__getEvents();

    // Clear out uPlot scaffolding canvas changes, we'll only assert on the changes introduced from invoking `drawMarkers`
    testEvents.ctx.__clearDrawCalls();
    testEvents.ctx.__clearEvents();
    testEvents.ctx.__clearPath();

    return { testEvents, uPlotEvents };
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
        it.each([['events', (u) => u.ctx.__getEvents()]] satisfies Array<[string, (u: uPlot) => unknown]>)(
          '%s',
          async (_, setup) => {
            const { testEvents, uPlotEvents } = await getPlot(dataOverrides ?? defaultData, seriesOverrides);
            expect(() => getDraw(drawOverrides)(testEvents)).not.toThrow();
            expect(scrubOutput(setup(testEvents))).toMatchUPlotSnapshot(dataOverrides ?? defaultData, uPlotEvents, {
              width,
              height,
            });
          }
        );
      }
    );
  });

  describe('candle with volume', () => {
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

    it.each([['events', (u) => u.ctx.__getEvents()]] satisfies Array<[string, (u: uPlot) => unknown]>)(
      '%s',
      async (_, setup) => {
        const { testEvents, uPlotEvents } = await getPlot(defaultData, volumeSeries);
        expect(() => getDraw(volumeOpts)(testEvents)).not.toThrow();
        expect(scrubOutput(setup(testEvents))).toMatchUPlotSnapshot(defaultData, uPlotEvents, { width, height });
      }
    );
  });
});
