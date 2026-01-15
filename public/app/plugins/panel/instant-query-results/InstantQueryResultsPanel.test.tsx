import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import { InstantQueryResultsPanel } from './InstantQueryResultsPanel';
import { Options } from './panelcfg.gen';

type InstantQueryResultsPanelProps = PanelProps<Options>;

const completeDefaultOptions: Options = {
  displayMode: 'table',
  showToggle: true,
  expandedRawView: false,
};

describe('InstantQueryResultsPanel', () => {
  describe('when there is no data', () => {
    it('shows "0 series returned" message', () => {
      const panelData = buildPanelData();

      render(<InstantQueryResultsPanel {...panelData} />);

      expect(screen.getByText(/0 series returned/i)).toBeInTheDocument();
    });
  });

  describe('when there is data', () => {
    it('renders table view by default', () => {
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

      render(<InstantQueryResultsPanel {...panelData} />);

      // Should render a table - check for table role
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders raw view when displayMode is raw', () => {
      const panelData = buildPanelData({
        options: {
          ...completeDefaultOptions,
          displayMode: 'raw',
          showToggle: true,
        },
        data: {
          series: [
            toDataFrame({
              fields: [
                { name: '__name__', type: FieldType.string, values: ['up'] },
                { name: 'Value', type: FieldType.number, values: [1] },
              ],
            }),
          ],
          timeRange: createTimeRange(),
          state: LoadingState.Done,
        },
      });

      render(<InstantQueryResultsPanel {...panelData} />);

      // Should show "Expand results" switch in raw view
      expect(screen.getByText(/Expand results/i)).toBeInTheDocument();
    });

    it('shows toggle when showToggle is true', () => {
      const panelData = buildPanelData({
        options: {
          ...completeDefaultOptions,
          showToggle: true,
        },
        data: {
          series: [
            toDataFrame({
              fields: [
                { name: '__name__', type: FieldType.string, values: ['up'] },
                { name: 'Value', type: FieldType.number, values: [1] },
              ],
            }),
          ],
          timeRange: createTimeRange(),
          state: LoadingState.Done,
        },
      });

      render(<InstantQueryResultsPanel {...panelData} />);

      // Should show both toggle options
      expect(screen.getByRole('radio', { name: 'Table' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Raw' })).toBeInTheDocument();
    });

    it('calls onOptionsChange when toggle is clicked', async () => {
      const onOptionsChange = jest.fn();
      const panelData = buildPanelData({
        options: {
          ...completeDefaultOptions,
          displayMode: 'table',
          showToggle: true,
        },
        onOptionsChange,
        data: {
          series: [
            toDataFrame({
              fields: [
                { name: '__name__', type: FieldType.string, values: ['up'] },
                { name: 'Value', type: FieldType.number, values: [1] },
              ],
            }),
          ],
          timeRange: createTimeRange(),
          state: LoadingState.Done,
        },
      });

      render(<InstantQueryResultsPanel {...panelData} />);

      // Click on Raw toggle
      const rawRadio = screen.getByRole('radio', { name: 'Raw' });
      await userEvent.click(rawRadio);

      expect(onOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          displayMode: 'raw',
        })
      );
    });
  });
});

function buildPanelData(overrideValues?: Partial<InstantQueryResultsPanelProps>): InstantQueryResultsPanelProps {
  const timeRange = createTimeRange();
  const defaultValues: InstantQueryResultsPanelProps = {
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
    title: 'Instant Query Results',
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
