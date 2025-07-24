import { render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';

import {
  LoadingState,
  createDataFrame,
  FieldType,
  LogsSortOrder,
  getDefaultTimeRange,
  LogsDedupStrategy,
  EventBusSrv,
  DataFrameType,
  LogSortOrderChangeEvent,
} from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import { LogsPanel } from './LogsPanel';

type LogsPanelProps = ComponentProps<typeof LogsPanel>;

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(() => [true, jest.fn()]),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(),
}));

const defaultProps = {
  data: {
    error: undefined,
    request: {
      panelId: 4,
      app: 'dashboard',
      requestId: 'A',
      timezone: 'browser',
      interval: '30s',
      intervalMs: 30000,
      maxDataPoints: 823,
      targets: [],
      range: getDefaultTimeRange(),
      scopedVars: {},
      startTime: 1,
    },
    series: [
      createDataFrame({
        refId: 'A',
        fields: [
          {
            name: 'timestamp',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z'],
          },
          {
            name: 'body',
            type: FieldType.string,
            values: ['logline text'],
          },
          {
            name: 'labels',
            type: FieldType.other,
            values: [
              {
                app: 'common_app',
              },
            ],
          },
        ],
        meta: {
          type: DataFrameType.LogLines,
        },
      }),
    ],
    state: LoadingState.Done,
    timeRange: getDefaultTimeRange(),
  },
  timeZone: 'utc',
  timeRange: getDefaultTimeRange(),
  options: {
    showLabels: false,
    showTime: false,
    wrapLogMessage: false,
    sortOrder: LogsSortOrder.Descending,
    dedupStrategy: LogsDedupStrategy.none,
    enableLogDetails: false,
    enableInfiniteScrolling: false,
    showControls: false,
    syntaxHighlighting: false,
  },
  title: 'Logs panel',
  id: 1,
  transparent: false,
  width: 400,
  height: 100,
  renderCounter: 0,
  fieldConfig: {
    defaults: {},
    overrides: [],
  },
  eventBus: new EventBusSrv(),
  onOptionsChange: jest.fn(),
  onFieldConfigChange: jest.fn(),
  replaceVariables: jest.fn(),
  onChangeTimeRange: jest.fn(),
};

const publishMock = jest.fn();
beforeAll(() => {
  jest.mocked(getAppEvents).mockReturnValue({
    publish: publishMock,
    getStream: jest.fn(),
    subscribe: jest.fn(),
    removeAllListeners: jest.fn(),
    newScopedBus: jest.fn(),
  });
});

describe('LogsPanel', () => {
  test('Renders a list of logs without controls ', async () => {
    setup();
    await screen.findByText('logline text');
    expect(screen.queryByLabelText('Scroll to bottom')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Display levels')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll to top')).not.toBeInTheDocument();
  });

  test('Renders a list of logs with controls', async () => {
    setup({ options: { ...defaultProps.options, showControls: true } });
    await screen.findByText('logline text');
    expect(screen.getByLabelText('Scroll to bottom')).toBeInTheDocument();
    expect(screen.getByLabelText('Display levels')).toBeInTheDocument();
    expect(screen.getByLabelText('Scroll to top')).toBeInTheDocument();
  });

  test('Publishes an event with the current sort order', async () => {
    publishMock.mockClear();
    setup();

    await screen.findByText('logline text');

    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledWith(
      new LogSortOrderChangeEvent({
        order: LogsSortOrder.Descending,
      })
    );
  });
});

const setup = (propsOverrides?: Partial<LogsPanelProps>) => {
  const props: LogsPanelProps = {
    ...defaultProps,
    data: {
      ...(propsOverrides?.data || defaultProps.data),
    },
    options: {
      ...(propsOverrides?.options || defaultProps.options),
    },
  };

  return { ...render(<LogsPanel {...props} />), props };
};
