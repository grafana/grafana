import { render } from '@testing-library/react';
import createMockRaf from 'mock-raf';
import React from 'react';
import uPlot from 'uplot';

import { dateTime, FieldConfig, FieldType, MutableDataFrame } from '@grafana/data';
import { GraphFieldConfig, GraphDrawStyle } from '@grafana/schema';

import { UPlotChart } from './Plot';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';
import { SeriesProps } from './config/UPlotSeriesBuilder';
import { preparePlotData2, getStackingGroups } from './utils';

const mockRaf = createMockRaf();
const setDataMock = jest.fn();
const setSizeMock = jest.fn();
const initializeMock = jest.fn();
const destroyMock = jest.fn();

jest.mock('uplot', () => {
  return jest.fn().mockImplementation(() => {
    return {
      setData: setDataMock,
      setSize: setSizeMock,
      initialize: initializeMock,
      destroy: destroyMock,
    };
  });
});

const mockData = () => {
  const data = new MutableDataFrame();

  data.addField({
    type: FieldType.time,
    name: 'Time',
    values: [1602630000000, 1602633600000, 1602637200000],
    config: {},
  });

  data.addField({
    type: FieldType.number,
    name: 'Value',
    values: [10, 20, 5],
    config: {
      custom: {
        drawStyle: GraphDrawStyle.Line,
      },
    } as FieldConfig<GraphFieldConfig>,
  });

  const timeRange = {
    from: dateTime(1602673200000),
    to: dateTime(1602680400000),
    raw: { from: '1602673200000', to: '1602680400000' },
  };

  const config = new UPlotConfigBuilder();
  config.addSeries({} as SeriesProps);
  return { data: data, timeRange, config };
};

describe('UPlotChart', () => {
  beforeEach(() => {
    // @ts-ignore
    uPlot.mockClear();
    setDataMock.mockClear();
    setSizeMock.mockClear();
    initializeMock.mockClear();
    destroyMock.mockClear();

    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(mockRaf.raf);
  });

  it('destroys uPlot instance when component unmounts', () => {
    const { data, timeRange, config } = mockData();

    const { unmount } = render(
      <UPlotChart
        data={preparePlotData2(data, getStackingGroups(data))} // mock
        config={config}
        timeRange={timeRange}
        width={100}
        height={100}
      />
    );

    expect(uPlot).toBeCalledTimes(1);
    unmount();
    expect(destroyMock).toBeCalledTimes(1);
  });

  describe('data update', () => {
    it('skips uPlot reinitialization when there are no field config changes', () => {
      const { data, timeRange, config } = mockData();

      const { rerender } = render(
        <UPlotChart
          data={preparePlotData2(data, getStackingGroups(data))} // mock
          config={config}
          timeRange={timeRange}
          width={100}
          height={100}
        />
      );

      expect(uPlot).toBeCalledTimes(1);

      data.fields[1].values.set(0, 1);

      rerender(
        <UPlotChart
          data={preparePlotData2(data, getStackingGroups(data))} // changed
          config={config}
          timeRange={timeRange}
          width={100}
          height={100}
        />
      );

      expect(setDataMock).toBeCalledTimes(1);
    });
  });

  describe('config update', () => {
    it('skips uPlot intialization for width and height equal 0', async () => {
      const { data, timeRange, config } = mockData();
      const { queryAllByTestId } = render(
        <UPlotChart
          data={preparePlotData2(data, getStackingGroups(data))}
          config={config}
          timeRange={timeRange}
          width={0}
          height={0}
        />
      );

      expect(queryAllByTestId('uplot-main-div')).toHaveLength(1);
      expect(uPlot).not.toBeCalled();
    });

    it('reinitializes uPlot when config changes', () => {
      const { data, timeRange, config } = mockData();

      const { rerender } = render(
        <UPlotChart
          data={preparePlotData2(data, getStackingGroups(data))} // frame
          config={config}
          timeRange={timeRange}
          width={100}
          height={100}
        />
      );

      expect(uPlot).toBeCalledTimes(1);

      const nextConfig = new UPlotConfigBuilder();
      nextConfig.addSeries({} as SeriesProps);

      rerender(
        <UPlotChart
          data={preparePlotData2(data, getStackingGroups(data))}
          config={nextConfig}
          timeRange={timeRange}
          width={100}
          height={100}
        />
      );

      expect(destroyMock).toBeCalledTimes(1);
      expect(uPlot).toBeCalledTimes(2);
    });

    it('skips uPlot reinitialization when only dimensions change', () => {
      const { data, timeRange, config } = mockData();

      const { rerender } = render(
        <UPlotChart
          data={preparePlotData2(data, getStackingGroups(data))} // frame
          config={config}
          timeRange={timeRange}
          width={100}
          height={100}
        />
      );

      // we wait 1 frame for plugins initialisation logic to finish
      rerender(
        <UPlotChart
          data={preparePlotData2(data, getStackingGroups(data))} // frame
          config={config}
          timeRange={timeRange}
          width={200}
          height={200}
        />
      );

      expect(destroyMock).toBeCalledTimes(0);
      expect(uPlot).toBeCalledTimes(1);
      expect(setSizeMock).toBeCalledTimes(1);
    });
  });
});
