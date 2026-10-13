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

const custom = { drawStyle: GraphDrawStyle.Bars, stacking: { mode: StackingMode.Normal, group: 'A' } };

const makeFrame = (power: number[]) =>
  createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, config: {}, values: [1000, 2000, 3000, 4000] },
      { name: 'power', type: FieldType.number, config: { custom }, values: power },
      { name: 'loss', type: FieldType.number, config: { custom }, values: [150, 150, 150, 150] },
    ],
  });

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
});
