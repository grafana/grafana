import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';
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
} from '@grafana/data';
import * as styles from 'app/features/logs/components/getLogRowStyles';
import { LogRowContextModal } from 'app/features/logs/components/log-context/LogRowContextModal';

import { LogsPanel } from './LogsPanel';

type LogsPanelProps = ComponentProps<typeof LogsPanel>;
type LogRowContextModalProps = ComponentProps<typeof LogRowContextModal>;

const logRowContextModalMock = jest.fn().mockReturnValue(<div>LogRowContextModal</div>);
jest.mock('app/features/logs/components/log-context/LogRowContextModal', () => ({
  LogRowContextModal: (props: LogRowContextModalProps) => logRowContextModalMock(props),
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
  getDataSourceSrv: () => getDataSourceSrvMock(),
}));

const hasLogsContextSupport = jest.fn().mockImplementation((ds) => {
  return ds.name === 'show-context';
});
jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  hasLogsContextSupport: (ds: MockDataSourceApi) => hasLogsContextSupport(ds),
}));

describe('LogsPanel', () => {
  describe('when returned series include common labels', () => {
    const seriesWithCommonLabels = [
      createDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z', '2019-04-26T14:42:50.991981292Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: [
              't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
              't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
            ],
            labels: {
              app: 'common_app',
              job: 'common_job',
            },
          },
        ],
      }),
    ];

    it('shows common labels when showCommonLabels is set to true', async () => {
      setup({ data: { series: seriesWithCommonLabels }, options: { showCommonLabels: true } });

      expect(await screen.findByText(/common labels:/i)).toBeInTheDocument();
      expect(await screen.findByText(/common_app/i)).toBeInTheDocument();
      expect(await screen.findByText(/common_job/i)).toBeInTheDocument();
    });
    it('shows common labels on top when descending sort order', async () => {
      const { container } = setup({
        data: { series: seriesWithCommonLabels },
        options: { showCommonLabels: true, sortOrder: LogsSortOrder.Descending },
      });
      expect(await screen.findByText(/common labels:/i)).toBeInTheDocument();
      expect(container.firstChild?.childNodes[0].textContent).toMatch(/^Common labels:common_appcommon_job/);
    });
    it('shows common labels on bottom when ascending sort order', async () => {
      const { container } = setup({
        data: { series: seriesWithCommonLabels },
        options: { showCommonLabels: true, sortOrder: LogsSortOrder.Ascending },
      });
      expect(await screen.findByText(/common labels:/i)).toBeInTheDocument();
      expect(container.firstChild?.childNodes[0].textContent).toMatch(/Common labels:common_appcommon_job$/);
    });
    it('does not show common labels when showCommonLabels is set to false', async () => {
      setup({ data: { series: seriesWithCommonLabels }, options: { showCommonLabels: false } });

      await waitFor(async () => {
        expect(screen.queryByText(/common labels:/i)).toBeNull();
        expect(screen.queryByText(/common_app/i)).toBeNull();
        expect(screen.queryByText(/common_job/i)).toBeNull();
      });
    });
  });
  describe('when returned series does not include common labels', () => {
    const seriesWithoutCommonLabels = [
      createDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z', '2019-04-26T14:42:50.991981292Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: [
              't=2019-04-26T11:05:28+0200 lvl=info msg="Initializing DatasourceCacheService" logger=server',
              't=2019-04-26T16:42:50+0200 lvl=eror msg="new token…t unhashed token=56d9fdc5c8b7400bd51b060eea8ca9d7',
            ],
          },
        ],
      }),
    ];
    it('shows (no common labels) when showCommonLabels is set to true', async () => {
      setup({ data: { series: seriesWithoutCommonLabels }, options: { showCommonLabels: true } });

      expect(await screen.findByText(/common labels:/i)).toBeInTheDocument();
      expect(await screen.findByText(/(no common labels)/i)).toBeInTheDocument();
    });
    it('does not show common labels when showCommonLabels is set to false', async () => {
      setup({ data: { series: seriesWithoutCommonLabels }, options: { showCommonLabels: false } });
      await waitFor(async () => {
        expect(screen.queryByText(/common labels:/i)).toBeNull();
        expect(screen.queryByText(/(no common labels)/i)).toBeNull();
      });
    });
  });

  describe('log context', () => {
    const series = [
      createDataFrame({
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z', '2019-04-26T14:42:50.991981292Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: ['logline text'],
            labels: {
              app: 'common_app',
              job: 'common_job',
            },
          },
        ],
      }),
    ];

    beforeEach(() => {
      showContextDs.getLogRowContext = jest.fn().mockImplementation(() => {});
    });

    it('should not show the toggle if the datasource does not support show context', async () => {
      setup({
        data: {
          series,
          options: { showCommonLabels: false },
          request: {
            app: CoreApp.Dashboard,
            targets: [{ refId: 'A', datasource: { uid: 'no-show-context' } }],
          },
        },
      });

      await waitFor(async () => {
        await userEvent.hover(screen.getByText(/logline text/i));
        expect(screen.queryByLabelText(/show context/i)).toBeNull();
      });
    });

    it('should show the toggle if the datasource does support show context', async () => {
      setup({
        data: {
          series,
          options: { showCommonLabels: false },
          request: {
            app: CoreApp.Dashboard,
            targets: [{ refId: 'A', datasource: { uid: 'show-context' } }],
          },
        },
      });

      await waitFor(async () => {
        await userEvent.hover(screen.getByText(/logline text/i));
        expect(screen.getByLabelText(/show context/i)).toBeInTheDocument();
      });
    });

    it('should not show the toggle if the datasource does support show context but the app is not Dashboard', async () => {
      setup({
        data: {
          series,
          options: { showCommonLabels: false },
          request: {
            app: CoreApp.CloudAlerting,
            targets: [{ refId: 'A', datasource: { uid: 'show-context' } }],
          },
        },
      });

      await waitFor(async () => {
        await userEvent.hover(screen.getByText(/logline text/i));
        expect(screen.queryByLabelText(/show context/i)).toBeNull();
      });
    });

    it('should render the mocked `LogRowContextModal` after click', async () => {
      setup({
        data: {
          series,
          options: { showCommonLabels: false },
          request: {
            app: CoreApp.Dashboard,
            targets: [{ refId: 'A', datasource: { uid: 'show-context' } }],
          },
        },
      });
      await waitFor(async () => {
        await userEvent.hover(screen.getByText(/logline text/i));
        await userEvent.click(screen.getByLabelText(/show context/i));
        expect(screen.getByText(/LogRowContextModal/i)).toBeInTheDocument();
      });
    });

    it('should call `getLogRowContext` if the user clicks the show context toggle', async () => {
      setup({
        data: {
          series,
          options: { showCommonLabels: false },
          request: {
            app: CoreApp.Dashboard,
            targets: [{ refId: 'A', datasource: { uid: 'show-context' } }],
          },
        },
      });
      await waitFor(async () => {
        await userEvent.hover(screen.getByText(/logline text/i));
        await userEvent.click(screen.getByLabelText(/show context/i));

        const getRowContextCb = logRowContextModalMock.mock.calls[0][0].getRowContext;
        getRowContextCb();
        expect(showContextDs.getLogRowContext).toBeCalled();
      });
    });
  });

  describe('Performance regressions', () => {
    const series = [
      createDataFrame({
        refId: 'A',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: ['2019-04-26T09:28:11.352440161Z'],
          },
          {
            name: 'message',
            type: FieldType.string,
            values: ['logline text'],
            labels: {
              app: 'common_app',
              job: 'common_job',
            },
          },
        ],
      }),
    ];

    beforeEach(() => {
      /**
       * For the lack of a better option, we spy on getLogRowStyles calls to count re-renders.
       */
      jest.spyOn(styles, 'getLogRowStyles');
      jest.mocked(styles.getLogRowStyles).mockClear();
    });

    it('does not rerender without changes', async () => {
      const { rerender, props } = setup({
        data: {
          series,
        },
      });

      expect(await screen.findByRole('row')).toBeInTheDocument();

      rerender(<LogsPanel {...props} />);

      expect(await screen.findByRole('row')).toBeInTheDocument();
      expect(styles.getLogRowStyles).toHaveBeenCalledTimes(3);
    });

    it('rerenders when prop changes', async () => {
      const { rerender, props } = setup({
        data: {
          series,
        },
      });

      expect(await screen.findByRole('row')).toBeInTheDocument();

      rerender(<LogsPanel {...props} data={{ ...props.data, series: [...series] }} />);

      expect(await screen.findByRole('row')).toBeInTheDocument();
      expect(jest.mocked(styles.getLogRowStyles).mock.calls.length).toBeGreaterThan(3);
    });
  });
});

const setup = (propsOverrides?: {}) => {
  const props: LogsPanelProps = {
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
      series: [],
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
    ...propsOverrides,
  };

  return { ...render(<LogsPanel {...props} />), props };
};
