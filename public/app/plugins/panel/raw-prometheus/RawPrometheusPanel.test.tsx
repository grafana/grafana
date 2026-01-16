import { render, screen } from '@testing-library/react';
import { uniqueId } from 'lodash';

import {
  dateMath,
  dateTime,
  EventBus,
  FieldType,
  LoadingState,
  PanelProps,
  TimeRange,
  toDataFrame,
} from '@grafana/data';

import { RawPrometheusPanel } from './RawPrometheusPanel';
import { Options } from './panelcfg.gen';

type RawPrometheusPanelProps = PanelProps<Options>;

const completeDefaultOptions: Options = {
  expandedView: false,
};

describe('RawPrometheusPanel', () => {
  describe('when there is no data', () => {
    it('shows "0 series returned" message', () => {
      const panelData = buildPanelData();

      render(<RawPrometheusPanel {...panelData} />);

      expect(screen.getByText(/0 series returned/i)).toBeInTheDocument();
    });
  });

  describe('when there is data', () => {
    it('renders raw list view', () => {
      const panelData = buildPanelData({
        data: {
          series: [
            toDataFrame({
              fields: [
                { name: '__name__', type: FieldType.string, values: ['up', 'up'] },
                { name: 'instance', type: FieldType.string, values: ['localhost:9090', 'localhost:9091'] },
                { name: 'Value', type: FieldType.number, values: [1, 1] },
              ],
            }),
          ],
          timeRange: createTimeRange(),
          state: LoadingState.Done,
        },
      });

      render(<RawPrometheusPanel {...panelData} />);

      // Should show "Expand results" switch in raw view
      expect(screen.getByText(/Expand results/i)).toBeInTheDocument();
    });

    it('renders metric names from data', () => {
      const panelData = buildPanelData({
        data: {
          series: [
            toDataFrame({
              fields: [
                { name: '__name__', type: FieldType.string, values: ['up'] },
                { name: 'instance', type: FieldType.string, values: ['localhost:9090'] },
                { name: 'Value', type: FieldType.number, values: [1] },
              ],
            }),
          ],
          timeRange: createTimeRange(),
          state: LoadingState.Done,
        },
      });

      render(<RawPrometheusPanel {...panelData} />);

      // Should render metric name
      expect(screen.getByText('up')).toBeInTheDocument();
    });
  });
});

function buildPanelData(overrideValues?: Partial<RawPrometheusPanelProps>): PrometheusInstantResultsPanelProps {
  const timeRange = createTimeRange();
  const defaultValues: PrometheusInstantResultsPanelProps = {
    id: Number(uniqueId()),
    data: {
      series: [],
      state: LoadingState.Done,
      timeRange,
    },
    options: {
      ...completeDefaultOptions,
    },
    transparent: false,
    timeRange,
    timeZone: 'utc',
    title: 'Raw Prometheus',
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    onFieldConfigChange: jest.fn(),
    onOptionsChange: jest.fn(),
    onChangeTimeRange: jest.fn(),
    replaceVariables: jest.fn((v) => v),
    renderCounter: 0,
    width: 800,
    height: 400,
    eventBus: {} as EventBus,
  };

  return {
    ...defaultValues,
    ...overrideValues,
  };
}

function createTimeRange(): TimeRange {
  return {
    from: dateMath.parse('now-6h') || dateTime(),
    to: dateMath.parse('now') || dateTime(),
    raw: { from: 'now-6h', to: 'now' },
  };
}
