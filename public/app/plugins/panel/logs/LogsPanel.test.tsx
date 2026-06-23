import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';
import { Provider } from 'react-redux';
import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';

import {
  LoadingState,
  createDataFrame,
  FieldType,
  LogsSortOrder,
  CoreApp,
  getDefaultTimeRange,
  LogsDedupStrategy,
  EventBusSrv,
  DataFrameType,
  LogSortOrderChangeEvent,
} from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
// eslint-disable-next-line no-restricted-imports
import * as grafanaUI from '@grafana/ui';
import { type LogLineContext } from 'app/features/logs/components/panel/LogLineContext';
import { configureStore } from 'app/store/configureStore';

import { LogsPanel } from './LogsPanel';
import * as useDatasourcesFromTargetsModule from './useDatasourcesFromTargets';

type LogsPanelProps = ComponentProps<typeof LogsPanel>;
type LogLineContextProps = ComponentProps<typeof LogLineContext>;

const logLineContextMock = jest.fn().mockReturnValue(<div>LogLineContext</div>);
jest.mock('app/features/logs/components/panel/LogLineContext', () => ({
  LogLineContext: (props: LogLineContextProps) => logLineContextMock(props),
}));

const defaultDs = new MockDataSourceApi('default datasource', { data: ['default data'] });
const noShowContextDs = new MockDataSourceApi('no-show-context');
const showContextDs = new MockDataSourceApi('show-context') as MockDataSourceApi & { getLogRowContext: jest.Mock };

const datasourceSrv = new DatasourceSrvMock(defaultDs, {
  'no-show-context': noShowContextDs,
  'show-context': showContextDs,
});
const getDataSourceSrvMock = jest.fn().mockReturnValue(datasourceSrv);
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(),
  getDataSourceSrv: () => getDataSourceSrvMock(),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

const hasLogsContextSupport = jest.fn().mockImplementation((ds) => {
  if (!ds) {
    return false;
  }
  return ds.name === 'show-context';
});
jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  hasLogsContextSupport: (ds: MockDataSourceApi) => hasLogsContextSupport(ds),
}));

jest.mock('@grafana/assistant', () => {
  return {
    ...jest.requireActual('@grafana/assistant'),
    useAssistant: jest.fn().mockReturnValue({ isLoading: false, isAvailable: true }),
  };
});

const useBooleanFlagValueMock = jest.fn((_: string, defaultValue: boolean) => defaultValue);
jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useBooleanFlagValue: (flag: string, defaultValue: boolean) => useBooleanFlagValueMock(flag, defaultValue),
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
    showCommonLabels: false,
    prettifyLogMessage: false,
    sortOrder: LogsSortOrder.Descending,
    dedupStrategy: LogsDedupStrategy.none,
    enableLogDetails: false,
    showLogContextToggle: false,
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

describe('LogsPanel missing time field', () => {
  it('shows "Data is missing a time field" when frames have rows but no time field', async () => {
    setupWithStore({
      data: {
        ...defaultProps.data,
        series: [
          createDataFrame({
            refId: 'A',
            fields: [{ name: 'body', type: FieldType.string, values: ['logline text'] }],
          }),
        ],
      },
    });

    expect(await screen.findByText('Data is missing a time field')).toBeInTheDocument();
  });

  it('shows "No data" instead when frames have no rows', async () => {
    setupWithStore({
      data: {
        ...defaultProps.data,
        series: [
          createDataFrame({
            refId: 'A',
            fields: [{ name: 'body', type: FieldType.string, values: [] }],
          }),
        ],
      },
    });

    expect(await screen.findByText('No data')).toBeInTheDocument();
    expect(screen.queryByText('Data is missing a time field')).not.toBeInTheDocument();
  });
});

describe.each([false, true])('LogsPanel with controls = %s', (showControls: boolean) => {
  it('publishes an event with the current sort order', async () => {
    publishMock.mockClear();
    setup({}, showControls);

    await screen.findByText('logline text');

    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledWith(
      new LogSortOrderChangeEvent({
        order: LogsSortOrder.Descending,
      })
    );
  });

  describe('log context', () => {
    let useDatasourcesSpy: jest.SpyInstance;

    beforeEach(() => {
      useDatasourcesSpy = jest
        .spyOn(useDatasourcesFromTargetsModule, 'useDatasourcesFromTargets')
        .mockImplementation((targets) => {
          const map = new Map<string, MockDataSourceApi>();
          const target = targets?.[0];
          if (target?.refId && target.datasource?.uid) {
            if (target.datasource.uid === 'show-context') {
              map.set(target.refId, showContextDs);
            } else if (target.datasource.uid === 'no-show-context') {
              map.set(target.refId, noShowContextDs);
            }
          }
          return map;
        });
    });

    afterEach(() => {
      useDatasourcesSpy.mockRestore();
    });

    const series = [
      createDataFrame({
        refId: 'A',
        fields: [
          {
            name: 'timestamp',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z', '2019-04-26T14:42:50.991981292Z'],
          },
          {
            name: 'body',
            type: FieldType.string,
            values: ['logline text', 'more text'],
          },
          {
            name: 'labels',
            type: FieldType.other,
            values: [
              {
                app: 'common_app',
                job: 'common_job',
              },
              {
                app: 'common_app',
                job: 'common_job',
              },
            ],
          },
        ],
        meta: {
          type: DataFrameType.LogLines,
        },
      }),
    ];

    beforeEach(() => {
      showContextDs.getLogRowContext = jest.fn().mockImplementation(() => {});
    });

    it('should not show the toggle if the datasource does not support show context', async () => {
      setup(
        {
          data: {
            ...defaultProps.data,
            series,
            request: {
              ...defaultProps.data.request,
              app: CoreApp.Dashboard,
              targets: [{ refId: 'A', datasource: { uid: 'no-show-context' } }],
            },
          },
        },
        showControls
      );

      await userEvent.click((await screen.findAllByLabelText('Log menu'))[0]);
      expect(screen.queryByText('Show context')).not.toBeInTheDocument();
    });

    it('should show the toggle if the datasource does support show context', async () => {
      setup(
        {
          data: {
            ...defaultProps.data,
            series,
            request: {
              ...defaultProps.data.request,
              app: CoreApp.Dashboard,
              targets: [{ refId: 'A', datasource: { uid: 'show-context' } }],
            },
          },
        },
        showControls
      );

      await userEvent.click((await screen.findAllByLabelText('Log menu'))[0]);
      expect(await screen.findByText('Show context')).toBeInTheDocument();
    });

    it('should not show the toggle if the datasource does support show context but the app is not Dashboard', async () => {
      setup(
        {
          data: {
            ...defaultProps.data,
            series,
            request: {
              ...defaultProps.data.request,
              app: CoreApp.CloudAlerting,
              targets: [{ refId: 'A', datasource: { uid: 'show-context' } }],
            },
          },
        },
        showControls
      );

      await userEvent.click((await screen.findAllByLabelText('Log menu'))[0]);
      expect(screen.queryByText('Show context')).not.toBeInTheDocument();
    });

    it('should render the mocked `LogLineContext` after click', async () => {
      setup(
        {
          data: {
            ...defaultProps.data,
            series,
            request: {
              ...defaultProps.data.request,
              app: CoreApp.Dashboard,
              targets: [{ refId: 'A', datasource: { uid: 'show-context' } }],
            },
          },
        },
        showControls
      );
      await userEvent.click((await screen.findAllByLabelText('Log menu'))[0]);
      await userEvent.click(screen.getByText('Show context'));
      expect(screen.getByText(/LogLineContext/i)).toBeInTheDocument();
    });

    it('should call `getLogRowContext` if the user clicks the show context toggle', async () => {
      setup(
        {
          data: {
            ...defaultProps.data,
            series,
            request: {
              ...defaultProps.data.request,
              app: CoreApp.Dashboard,
              targets: [{ refId: 'A', datasource: { uid: 'show-context' } }],
            },
          },
        },
        showControls
      );
      await userEvent.click((await screen.findAllByLabelText('Log menu'))[0]);
      await userEvent.click(screen.getByText('Show context'));

      const getRowContextCb = logLineContextMock.mock.calls[0][0].getRowContext;
      getRowContextCb({}, {});
      expect(showContextDs.getLogRowContext).toBeCalled();
    });

    it('supports adding custom options to the log row menu', async () => {
      const customOptionClick = jest.fn();

      setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
          options: {
            ...defaultProps.options,
            logLineMenuCustomItems: [{ label: 'Custom option', onClick: customOptionClick }],
          },
        },
        showControls
      );

      await userEvent.click((await screen.findAllByLabelText('Log menu'))[0]);
      expect(screen.getByText('Custom option')).toBeInTheDocument();
    });
  });

  describe('Performance regressions', () => {
    const series = [
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
                job: 'common_job',
              },
            ],
          },
        ],
        meta: {
          type: DataFrameType.LogLines,
        },
      }),
    ];

    it('does not rerender without changes', async () => {
      const { rerender, props } = setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
        },
        showControls
      );

      expect(await screen.findByText('logline text')).toBeInTheDocument();

      rerender(<LogsPanel {...props} />);

      expect(await screen.findByText('logline text')).toBeInTheDocument();
    });

    it('rerenders when prop changes', async () => {
      const { rerender, props } = setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
        },
        showControls
      );

      expect(await screen.findByText('logline text')).toBeInTheDocument();

      const updatedSeries = [
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
              values: ['updated logline text'],
            },
            {
              name: 'labels',
              type: FieldType.other,
              values: [
                {
                  app: 'common_app',
                  job: 'common_job',
                },
              ],
            },
          ],
          meta: {
            type: DataFrameType.LogLines,
          },
        }),
      ];

      rerender(<LogsPanel {...props} data={{ ...props.data, series: updatedSeries }} />);

      expect(await screen.findByText('updated logline text')).toBeInTheDocument();
      expect(screen.queryByText('logline text')).not.toBeInTheDocument();
    });

    it('does not re-render when data is loading', async () => {
      const { rerender, props } = setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
        },
        showControls
      );

      expect(await screen.findByText('logline text')).toBeInTheDocument();

      rerender(<LogsPanel {...props} data={{ ...props.data, state: LoadingState.Loading }} />);

      expect(await screen.findByText('logline text')).toBeInTheDocument();
    });
  });

  describe('Filters', () => {
    const series = [
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
    ];

    it('allows to filter for a value or filter out a value', async () => {
      const filterForMock = jest.fn();
      const filterOutMock = jest.fn();
      const isFilterLabelActiveMock = jest.fn();
      setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
          options: {
            ...defaultProps.options,
            showLabels: false,
            showTime: false,
            wrapLogMessage: false,
            showCommonLabels: false,
            prettifyLogMessage: false,
            sortOrder: LogsSortOrder.Descending,
            dedupStrategy: LogsDedupStrategy.none,
            enableLogDetails: true,
            onClickFilterLabel: filterForMock,
            onClickFilterOutLabel: filterOutMock,
            isFilterLabelActive: isFilterLabelActiveMock,
          },
        },
        showControls
      );

      expect(await screen.findByText('logline text')).toBeInTheDocument();

      await userEvent.click(screen.getByText('logline text'));
      await userEvent.click(screen.getByLabelText('Filter for value'));
      expect(filterForMock).toHaveBeenCalledTimes(1);
      await userEvent.click(screen.getByLabelText('Filter out value'));
      expect(filterOutMock).toHaveBeenCalledTimes(1);

      expect(isFilterLabelActiveMock).toHaveBeenCalledTimes(1);
    });

    describe('invalid handlers', () => {
      it('does not show the controls if onAddAdHocFilter is not defined', async () => {
        jest.spyOn(grafanaUI, 'usePanelContext').mockReturnValue({
          eventsScope: 'global',
          eventBus: new EventBusSrv(),
        });

        setup(
          {
            data: {
              ...defaultProps.data,
              series,
            },
            options: {
              ...defaultProps.options,
              enableLogDetails: true,
            },
          },
          showControls
        );

        expect(await screen.findByText('logline text')).toBeInTheDocument();

        await userEvent.click(screen.getByText('logline text'));

        expect(screen.queryByLabelText('Filter for value')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Filter out value')).not.toBeInTheDocument();
      });
      it('shows the controls if onAddAdHocFilter is defined', async () => {
        jest.spyOn(grafanaUI, 'usePanelContext').mockReturnValue({
          eventsScope: 'global',
          eventBus: new EventBusSrv(),
          onAddAdHocFilter: jest.fn(),
        });

        setup(
          {
            data: {
              ...defaultProps.data,
              series,
            },
            options: {
              ...defaultProps.options,
              enableLogDetails: true,
            },
          },
          showControls
        );

        expect(await screen.findByText('logline text')).toBeInTheDocument();

        await userEvent.click(screen.getByText('logline text'));

        expect(await screen.findByText('common_app')).toBeInTheDocument();

        expect(screen.getByLabelText('Filter for value')).toBeInTheDocument();
        expect(screen.getByLabelText('Filter out value')).toBeInTheDocument();
      });
    });
  });

  describe('Field selector', () => {
    const series = [
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
    ];

    it('shows field selector when showFieldSelector is enabled', async () => {
      setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
          options: {
            ...defaultProps.options,
            showFieldSelector: true,
            enableLogDetails: true,
          },
        },
        showControls
      );

      expect(await screen.findByText('logline text')).toBeInTheDocument();

      expect(screen.queryByPlaceholderText('Search fields by name')).toBeInTheDocument();
    });

    it('does not show field selector when showFieldSelector is disabled', async () => {
      setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
          options: {
            ...defaultProps.options,
            showFieldSelector: false,
            enableLogDetails: true,
          },
        },
        showControls
      );

      expect(await screen.findByText('logline text')).toBeInTheDocument();

      expect(screen.queryByPlaceholderText('Search fields by name')).not.toBeInTheDocument();
    });
  });

  describe('Show/hide fields', () => {
    const series = [
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
    ];

    it('displays the provided fields instead of the log line', async () => {
      setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
          options: {
            ...defaultProps.options,
            showLabels: false,
            showTime: false,
            wrapLogMessage: false,
            showCommonLabels: false,
            prettifyLogMessage: false,
            sortOrder: LogsSortOrder.Descending,
            dedupStrategy: LogsDedupStrategy.none,
            enableLogDetails: true,
            displayedFields: ['app'],
            onClickHideField: undefined,
            onClickShowField: undefined,
          },
        },
        showControls
      );

      expect(await screen.findByText('common_app')).toBeInTheDocument();
      expect(screen.queryByText('logline text')).not.toBeInTheDocument();

      await userEvent.click(screen.getByText('common_app'));

      expect(screen.getByLabelText('Hide this field')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Hide this field'));

      expect(screen.getByText('logline text')).toBeInTheDocument();
    });

    it('updates the provided fields instead of the log line', async () => {
      const { rerender, props } = setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
          options: {
            ...defaultProps.options,
            showLabels: false,
            showTime: false,
            wrapLogMessage: false,
            showCommonLabels: false,
            prettifyLogMessage: false,
            sortOrder: LogsSortOrder.Descending,
            dedupStrategy: LogsDedupStrategy.none,
            enableLogDetails: true,
            onClickHideField: undefined,
            onClickShowField: undefined,
          },
        },
        showControls
      );

      expect(await screen.findByText('logline text')).toBeInTheDocument();
      expect(screen.getByText('logline text')).toBeInTheDocument();

      rerender(<LogsPanel {...props} options={{ ...props.options, displayedFields: ['app'] }} />);

      expect(screen.queryByText('logline text')).not.toBeInTheDocument();
      expect(screen.getByText('common_app')).toBeTruthy();
    });

    it('enables the behavior with a default implementation', async () => {
      setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
          options: {
            ...defaultProps.options,
            showLabels: false,
            showTime: false,
            wrapLogMessage: false,
            showCommonLabels: false,
            prettifyLogMessage: false,
            sortOrder: LogsSortOrder.Descending,
            dedupStrategy: LogsDedupStrategy.none,
            enableLogDetails: true,
            displayedFields: [],
            onClickHideField: undefined,
            onClickShowField: undefined,
          },
        },
        showControls
      );

      expect(await screen.findByText('logline text')).toBeInTheDocument();

      await userEvent.click(screen.getByText('logline text'));
      await userEvent.click(screen.getByLabelText('Show this field instead of the message'));

      expect(screen.queryByText('logline text')).not.toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Hide this field'));

      expect(screen.getByText('logline text')).toBeInTheDocument();
    });

    it('overrides the default implementation when the callbacks are provided', async () => {
      const onClickShowFieldMock = jest.fn();

      setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
          options: {
            ...defaultProps.options,
            showLabels: false,
            showTime: false,
            wrapLogMessage: false,
            showCommonLabels: false,
            prettifyLogMessage: false,
            sortOrder: LogsSortOrder.Descending,
            dedupStrategy: LogsDedupStrategy.none,
            enableLogDetails: true,
            onClickHideField: jest.fn(),
            onClickShowField: onClickShowFieldMock,
          },
        },
        showControls
      );

      expect(await screen.findByText('logline text')).toBeInTheDocument();

      await userEvent.click(screen.getByText('logline text'));
      await userEvent.click(screen.getByLabelText('Show this field instead of the message'));

      expect(onClickShowFieldMock).toHaveBeenCalledTimes(1);
    });

    it('calls onOptionsChange with updated displayedFields when showing a field', async () => {
      const onOptionsChangeMock = jest.fn();

      setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
          options: {
            ...defaultProps.options,
            showLabels: false,
            showTime: false,
            wrapLogMessage: false,
            showCommonLabels: false,
            prettifyLogMessage: false,
            sortOrder: LogsSortOrder.Descending,
            dedupStrategy: LogsDedupStrategy.none,
            enableLogDetails: true,
            displayedFields: [],
            onClickHideField: undefined,
            onClickShowField: undefined,
          },
          onOptionsChange: onOptionsChangeMock,
        },
        showControls
      );

      expect(await screen.findByText('logline text')).toBeInTheDocument();
      expect(screen.getByText('logline text')).toBeInTheDocument();

      // Click to open log details
      await userEvent.click(screen.getByText('logline text'));
      // Click to show the 'app' field
      await userEvent.click(screen.getByLabelText('Show this field instead of the message'));

      // Verify onOptionsChange was called with the field shown
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          displayedFields: ['app'],
        })
      );
    });

    it('calls onOptionsChange with updated displayedFields when hiding a field', async () => {
      const onOptionsChangeMock = jest.fn();

      setup(
        {
          data: {
            ...defaultProps.data,
            series,
          },
          options: {
            ...defaultProps.options,
            showLabels: false,
            showTime: false,
            wrapLogMessage: false,
            showCommonLabels: false,
            prettifyLogMessage: false,
            sortOrder: LogsSortOrder.Descending,
            dedupStrategy: LogsDedupStrategy.none,
            enableLogDetails: true,
            displayedFields: ['app'],
            onClickHideField: undefined,
            onClickShowField: undefined,
          },
          onOptionsChange: onOptionsChangeMock,
        },
        showControls
      );

      expect(await screen.findByText('common_app')).toBeInTheDocument();
      expect(screen.queryByText('logline text')).not.toBeInTheDocument();

      await userEvent.click(screen.getByText('common_app'));
      // Click to hide the 'app' field
      await userEvent.click(screen.getByLabelText('Hide this field'));

      // Verify onOptionsChange was called with the field hidden
      expect(onOptionsChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          displayedFields: [],
        })
      );
    });
  });
});

const setup = (propsOverrides?: Partial<LogsPanelProps>, showControls = false) => {
  const props: LogsPanelProps = {
    ...defaultProps,
    ...propsOverrides,
    data: {
      ...(propsOverrides?.data || defaultProps.data),
    },
    options: {
      ...(propsOverrides?.options || defaultProps.options),
      showControls,
    },
  };

  return { ...render(<LogsPanel {...props} />), props };
};

const setupWithStore = (propsOverrides?: Partial<LogsPanelProps>) => {
  const props: LogsPanelProps = {
    ...defaultProps,
    ...propsOverrides,
    data: {
      ...(propsOverrides?.data || defaultProps.data),
    },
    options: propsOverrides?.options || defaultProps.options,
  };

  const store = configureStore();
  return {
    ...render(
      <Provider store={store}>
        <LogsPanel {...props} />
      </Provider>
    ),
    props,
  };
};
