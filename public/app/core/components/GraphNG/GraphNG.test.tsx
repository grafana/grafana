import { render } from '@testing-library/react';
import uPlot, { type AlignedData } from 'uplot';

import { createDataFrame, dateTime, FieldType, type TimeRange } from '@grafana/data';
import { GraphDrawStyle, LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/schema';

import { TimeSeries } from '../TimeSeries/TimeSeries';

// the last data uPlot received, either at (re)init or via setData()
let mockPlotData: AlignedData = [];

// uPlot draws to canvas, which jsdom lacks; keep its statics so config building still works
jest.mock('uplot', () => {
  const actual = jest.requireActual('uplot');
  return Object.assign(
    jest.fn().mockImplementation((_opts: unknown, data: AlignedData) => {
      mockPlotData = data;
      return {
        setData: (newData: AlignedData) => {
          mockPlotData = newData;
        },
        setSize: jest.fn(),
        destroy: jest.fn(),
      };
    }),
    actual
  );
});

const stacked = { drawStyle: GraphDrawStyle.Bars, stacking: { mode: StackingMode.Normal, group: 'A' } };
const unstacked = { drawStyle: GraphDrawStyle.Bars, stacking: { mode: StackingMode.None, group: 'A' } };

const makeFrame = (power: number[], custom = stacked) =>
  createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, config: {}, values: power.map((_, i) => 1000 * (i + 1)) },
      { name: 'power', type: FieldType.number, config: { custom }, values: power },
      { name: 'loss', type: FieldType.number, config: { custom }, values: power.map(() => 150) },
    ],
  });

// 13 of 25 values negative, or 12 of 25: a series hovering around zero
const nearZero = (negCount: number) => Array.from({ length: 25 }, (_, i) => (i < negCount ? -10 : 10));

const timeRange: TimeRange = {
  from: dateTime(1000),
  to: dateTime(4000),
  raw: { from: dateTime(1000), to: dateTime(4000) },
};

const legend = { showLegend: false, displayMode: LegendDisplayMode.List, placement: 'bottom' as const, calcs: [] };
const options = { tooltip: { mode: TooltipDisplayMode.Multi } };

const renderTimeSeries = (frame: ReturnType<typeof makeFrame>) => (
  <TimeSeries
    frames={[frame]}
    structureRev={1}
    width={400}
    height={200}
    timeRange={timeRange}
    timeZone="utc"
    legend={legend}
    options={options}
    replaceVariables={(v) => v}
  />
);

describe('GraphNG', () => {
  beforeEach(() => {
    jest.mocked(uPlot).mockClear();
    mockPlotData = [];
  });

  it('restacks series when new values flip a stack direction without a structure change', () => {
    // power is mostly negative here, so it stacks downward on its own
    const { rerender } = render(renderTimeSeries(makeFrame([-150, -150, -150, 300])));
    expect(mockPlotData[2]).toEqual([150, 150, 150, 150]);

    // power is now mostly positive, so loss should stack on top of it
    rerender(renderTimeSeries(makeFrame([300, 300, 300, -150])));
    expect(mockPlotData[2]).toEqual([450, 450, 450, 0]);
  });

  it('keeps the existing plot when new values do not change the stacking groups', () => {
    const { rerender } = render(renderTimeSeries(makeFrame([300, 300, 300, -150])));
    rerender(renderTimeSeries(makeFrame([200, 200, 200, -100])));

    expect(mockPlotData[2]).toEqual([350, 350, 350, 50]);
    expect(uPlot).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing plot when a series near zero tips back and forth across a 50/50 sign split', () => {
    const { rerender } = render(renderTimeSeries(makeFrame(nearZero(13))));

    for (let i = 0; i < 10; i++) {
      rerender(renderTimeSeries(makeFrame(nearZero(12))));
      rerender(renderTimeSeries(makeFrame(nearZero(13))));
    }

    expect(mockPlotData[2]).toEqual(Array(25).fill(150));
    expect(uPlot).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing plot for unstacked series when their values flip sign', () => {
    const { rerender } = render(renderTimeSeries(makeFrame([-150, -150, -150, 300], unstacked)));
    rerender(renderTimeSeries(makeFrame([300, 300, 300, -150], unstacked)));

    expect(mockPlotData[2]).toEqual([150, 150, 150, 150]);
    expect(uPlot).toHaveBeenCalledTimes(1);
  });
});
