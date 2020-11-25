import React from 'react';
import { GraphNG } from './GraphNG';
import { act, render } from '@testing-library/react';
import { ArrayVector, dateTime, FieldConfig, FieldType, MutableDataFrame } from '@grafana/data';
import { GraphFieldConfig, GraphMode } from '../uPlot/config';
import uPlot from 'uplot';
import createMockRaf from 'mock-raf';
import { LegendDisplayMode } from '..';
const mockRaf = createMockRaf();
const setDataMock = jest.fn();
const setSizeMock = jest.fn();
const initializeMock = jest.fn();

jest.mock('uplot', () => {
  return jest.fn().mockImplementation(() => {
    return {
      setData: setDataMock,
      setSize: setSizeMock,
      initialize: initializeMock,
      destroy: jest.fn(),
    };
  });
});

const mockData = () => {
  const data = new MutableDataFrame();

  data.addField({
    type: FieldType.time,
    name: 'Time',
    values: new ArrayVector([1602630000000, 1602633600000, 1602637200000]),
    config: {},
  });

  data.addField({
    type: FieldType.number,
    name: 'Value',
    values: new ArrayVector([10, 20, 5]),
    config: {
      custom: {
        mode: GraphMode.Line,
      },
    } as FieldConfig<GraphFieldConfig>,
  });

  const timeRange = {
    from: dateTime(1602673200000),
    to: dateTime(1602680400000),
    raw: { from: '1602673200000', to: '1602680400000' },
  };
  return { data, timeRange };
};

describe('GraphNG', () => {
  beforeEach(() => {
    setDataMock.mockClear();
    setSizeMock.mockClear();
    initializeMock.mockClear();
    // @ts-ignore
    uPlot.mockClear();

    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(mockRaf.raf);
  });

  describe('data update', () => {
    it('does not re-initialise uPlot when there are no field config changes', () => {
      const { data, timeRange } = mockData();

      const { rerender } = render(
        <GraphNG data={[data]} timeRange={timeRange} timeZone={'browser'} width={100} height={100} />
      );

      // we wait 1 frame for plugins initialisation logic to finish
      act(() => {
        mockRaf.step({ count: 1 });
      });
      expect(uPlot).toBeCalledTimes(1);

      const nextData = mockData();
      nextData.data.fields[1].values.set(0, 1);
      rerender(<GraphNG data={[nextData.data]} timeRange={timeRange} timeZone={'browser'} width={100} height={100} />);

      expect(setDataMock).toBeCalledTimes(1);
    });
  });

  describe('config update', () => {
    it('should skip plot intialization for width and height equal 0', async () => {
      const { data, timeRange } = mockData();

      const { queryAllByTestId } = render(
        <GraphNG
          data={[data]}
          timeRange={timeRange}
          timeZone={'browser'}
          width={0}
          height={0}
          legend={{ displayMode: LegendDisplayMode.Hidden, placement: 'bottom' }}
        />
      );

      expect(queryAllByTestId('uplot-main-div')).toHaveLength(1);
      expect(uPlot).not.toBeCalled();
    });

    it('reinitializes plot when number of series change', async () => {
      const { data, timeRange } = mockData();

      const { rerender } = render(
        <GraphNG
          data={[data]}
          timeRange={timeRange}
          timeZone={'browser'}
          width={100}
          height={100}
          legend={{ displayMode: LegendDisplayMode.Hidden, placement: 'bottom' }}
        />
      );

      // expect(uPlot).toBeCalledTimes(1);
      // we wait 1 frame for plugins initialisation logic to finish
      act(() => {
        mockRaf.step({ count: 1 });
      });

      data.addField({
        name: 'Value1',
        type: FieldType.number,
        values: new ArrayVector([1, 2, 3]),
        config: {
          custom: {
            lineWidth: 5,
          },
        } as FieldConfig<GraphFieldConfig>,
      });

      rerender(
        <GraphNG
          data={[data]}
          timeRange={timeRange}
          timeZone={'browser'}
          width={100}
          height={100}
          legend={{ displayMode: LegendDisplayMode.Hidden, placement: 'bottom' }}
        />
      );

      expect(uPlot).toBeCalledTimes(2);
    });

    it('reinitializes plot when field config changes', () => {
      const { data, timeRange } = mockData();

      const { rerender } = render(
        <GraphNG
          data={[data]}
          timeRange={timeRange}
          timeZone={'browser'}
          width={100}
          height={100}
          legend={{ displayMode: LegendDisplayMode.Hidden, placement: 'bottom' }}
        />
      );

      // we wait 1 frame for plugins initialisation logic to finish
      act(() => {
        mockRaf.step({ count: 1 });
      });

      expect(uPlot).toBeCalledTimes(1);
      const nextData = mockData();
      nextData.data.fields[1].config.custom.lineWidth = 5;

      // we wait 1 frame for plugins initialisation logic to finish
      rerender(
        <GraphNG
          data={[nextData.data]}
          timeRange={timeRange}
          timeZone={'browser'}
          width={100}
          height={100}
          legend={{ displayMode: LegendDisplayMode.Hidden, placement: 'bottom' }}
        />
      );
      mockRaf.step({ count: 1 });

      expect(uPlot).toBeCalledTimes(2);
    });
  });
});
