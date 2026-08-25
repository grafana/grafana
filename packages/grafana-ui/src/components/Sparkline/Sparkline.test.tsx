import { render, waitFor } from '@testing-library/react';
import type uPlot from 'uplot';

import { createTheme, dateTime, type FieldSparkline, FieldType, makeTimeRange } from '@grafana/data';

import { Sparkline } from './Sparkline';
import * as sparklineUtils from './utils';

const WIDTH = 800;
const HEIGHT = 600;

function makeSparkline(overrides: Partial<FieldSparkline> = {}): FieldSparkline {
  return {
    x: {
      name: 'x',
      values: [1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000],
      type: FieldType.time,
      config: {},
    },
    y: {
      name: 'y',
      values: [1, 2, 3, 4, 5],
      type: FieldType.number,
      config: {},
      state: { range: { min: 1, max: 5, delta: 4 } },
    },
    ...overrides,
  };
}

function renderSparkline(sparkline: FieldSparkline) {
  return render(<Sparkline width={WIDTH} height={HEIGHT} theme={createTheme()} sparkline={sparkline} />);
}

function scaleRange(plot: uPlot, scaleKey: string) {
  const { min, max } = plot.scales[scaleKey];
  return [min, max];
}

describe('Sparkline', () => {
  // The component builds its uPlot config internally and never exposes the instance, so hook the
  // real builder to read back the chart that was actually mounted.
  let plotInstance: uPlot | undefined;
  let prepareConfigSpy: jest.SpyInstance;
  const realPrepareConfig = sparklineUtils.prepareConfig;

  beforeEach(() => {
    plotInstance = undefined;
    prepareConfigSpy = jest.spyOn(sparklineUtils, 'prepareConfig').mockImplementation((...args) => {
      const builder = realPrepareConfig(...args);
      builder.addHook('ready', (u: uPlot) => {
        plotInstance = u;
      });
      return builder;
    });
  });

  afterEach(() => {
    prepareConfigSpy.mockRestore();
  });

  async function mountAndGetPlot(sparkline: FieldSparkline) {
    renderSparkline(sparkline);
    await waitFor(() => expect(plotInstance?.status).toBe(1));
    return plotInstance!;
  }

  it('plots the y values against the x values at the requested size, with both scales spanning the data', async () => {
    const plot = await mountAndGetPlot(makeSparkline());

    expect(plot.data).toEqual([
      [1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000],
      [1, 2, 3, 4, 5],
    ]);
    expect([plot.width, plot.height]).toEqual([WIDTH, HEIGHT]);
    expect(scaleRange(plot, 'x')).toEqual([1679839200000, 1682258400000]);
    expect(scaleRange(plot, '__fixed')).toEqual([1, 5]);
  });

  it('spans the x scale across the sparkline timeRange and null-pads the data across it', async () => {
    const plot = await mountAndGetPlot(
      makeSparkline({
        x: { name: 'x', values: [200, 400, 600], type: FieldType.time, config: { interval: 200 } },
        y: {
          name: 'y',
          values: [1, 2, 3],
          type: FieldType.number,
          config: {},
          state: { range: { min: 1, max: 3, delta: 2 } },
        },
        timeRange: makeTimeRange(dateTime(0), dateTime(1000)),
      })
    );

    expect(plot.data).toEqual([
      [0, 200, 400, 600, 800],
      [null, 1, 2, 3, null],
    ]);
    expect(scaleRange(plot, 'x')).toEqual([0, 1000]);
  });

  it('plots against a 0-based index when the sparkline has no x field', async () => {
    const plot = await mountAndGetPlot(
      makeSparkline({
        x: undefined,
        y: {
          name: 'y',
          values: [4, 8, 6],
          type: FieldType.number,
          config: {},
          state: { range: { min: 4, max: 8, delta: 4 } },
        },
      })
    );

    expect(plot.data).toEqual([
      [0, 1, 2],
      [4, 8, 6],
    ]);
    expect(scaleRange(plot, 'x')).toEqual([0, 2]);
    expect(scaleRange(plot, '__fixed')).toEqual([4, 8]);
  });

  // Fewer than two values cannot describe a trend, so prepareSeries returns a warning and the
  // component renders nothing rather than a misleading single-point chart.
  it.each([
    { desc: 'a single value', xValues: [1679839200000], yValues: [1] },
    { desc: 'no values', xValues: [], yValues: [] },
  ])('renders nothing when the sparkline has $desc', ({ xValues, yValues }) => {
    const { container } = renderSparkline(
      makeSparkline({
        x: { name: 'x', values: xValues, type: FieldType.time, config: {} },
        y: { name: 'y', values: yValues, type: FieldType.number, config: {}, state: {} },
      })
    );

    expect(container).toBeEmptyDOMElement();
  });
});
