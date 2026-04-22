import { render, screen } from '@testing-library/react';

import { FieldType, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';

import { getPanelProps } from '../test-utils';

import { CandlestickPanel } from './CandlestickPanel';
import { defaultOptions } from './defaultOptions';
import { type Options, VizDisplayMode } from './panelcfg.gen';

jest.mock('app/core/components/TimeSeries/TimeSeries', () => ({
  TimeSeries: function TimeSeriesStub() {
    return <div data-testid="candlestick-timeseries-stub" />;
  },
}));

const defaultPanelOptions = defaultOptions as Options;

/** OHLC frame for mode: Candles */
function createValidCandlestickFrame() {
  return toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000] },
      { name: 'open', values: [10, 11] },
      { name: 'high', values: [12, 13] },
      { name: 'low', values: [9, 10] },
      { name: 'close', values: [11, 12] },
    ],
  });
}

/** mode: Volume */
function createVolumeModeFrame() {
  return toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000] },
      { name: 'open', values: [10, 11] },
      { name: 'close', values: [11, 12] },
      { name: 'volume', values: [100, 110], config: { custom: { fillOpacity: 50 } } },
    ],
  });
}

/** Full OHLCV for mode: CandlesVolume */
function createCandlesVolumeFrame() {
  return toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000] },
      { name: 'open', values: [10, 11] },
      { name: 'high', values: [12, 13] },
      { name: 'low', values: [9, 10] },
      { name: 'close', values: [11, 12] },
      { name: 'volume', values: [100, 110], config: { custom: {} } },
    ],
  });
}

describe('CandlestickPanel', () => {
  describe('Unable to render data', () => {
    it('empty', () => {
      const props = getPanelProps<Options>(defaultPanelOptions, {
        data: {
          state: LoadingState.Done,
          series: [],
          timeRange: getDefaultTimeRange(),
        },
      });

      render(<CandlestickPanel {...props} />);

      expect(screen.getByText(/Unable to render data/i)).toBeVisible();
    });

    it('missing time field', () => {
      const frame = toDataFrame({
        name: 'hello',
        columns: ['a', 'b', 'c'],
        rows: [
          ['A', 2, 3],
          ['B', 4, 5],
        ],
      });

      const props = getPanelProps<Options>(defaultPanelOptions, {
        data: {
          state: LoadingState.Done,
          series: [frame],
          timeRange: getDefaultTimeRange(),
        },
      });

      render(<CandlestickPanel {...props} />);

      expect(screen.getByText(/Unable to render data/i)).toBeVisible();
    });
  });

  describe('stubbed TimeSeries', () => {
    function expectRendersChart(props: ReturnType<typeof getPanelProps<Options>>) {
      render(<CandlestickPanel {...props} />);
      expect(screen.queryByText(/Unable to render data/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('candlestick-timeseries-stub')).toBeVisible();
    }

    it('renders when mode is candles', () => {
      const props = getPanelProps<Options>(
        { ...defaultPanelOptions, mode: VizDisplayMode.Candles },
        {
          data: {
            state: LoadingState.Done,
            series: [createValidCandlestickFrame()],
            timeRange: getDefaultTimeRange(),
          },
        }
      );
      expectRendersChart(props);
    });

    it('renders when mode is volume', () => {
      const props = getPanelProps<Options>(
        { ...defaultPanelOptions, mode: VizDisplayMode.Volume },
        {
          data: {
            state: LoadingState.Done,
            series: [createVolumeModeFrame()],
            timeRange: getDefaultTimeRange(),
          },
        }
      );
      expectRendersChart(props);
    });

    it('renders when mode is candles and volume', () => {
      const props = getPanelProps<Options>(
        { ...defaultPanelOptions, mode: VizDisplayMode.CandlesVolume },
        {
          data: {
            state: LoadingState.Done,
            series: [createCandlesVolumeFrame()],
            timeRange: getDefaultTimeRange(),
          },
        }
      );
      expectRendersChart(props);
    });
  });
});
