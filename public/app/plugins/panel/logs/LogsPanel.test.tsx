import { render, screen } from '@testing-library/react';
import React, { ComponentProps } from 'react';

import { LoadingState, createDataFrame, FieldType, LogsSortOrder } from '@grafana/data';

import { LogsPanel } from './LogsPanel';

type LogsPanelProps = ComponentProps<typeof LogsPanel>;

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

    it('shows common labels when showCommonLabels is set to true', () => {
      setup({ data: { series: seriesWithCommonLabels }, options: { showCommonLabels: true } });

      expect(screen.getByText(/common labels:/i)).toBeInTheDocument();
      expect(screen.getByText(/common_app/i)).toBeInTheDocument();
      expect(screen.getByText(/common_job/i)).toBeInTheDocument();
    });
    it('shows common labels on top when descending sort order', () => {
      const { container } = setup({
        data: { series: seriesWithCommonLabels },
        options: { showCommonLabels: true, sortOrder: LogsSortOrder.Descending },
      });

      expect(container.firstChild?.childNodes[0].textContent).toMatch(/^Common labels:common_appcommon_job/);
    });
    it('shows common labels on bottom when ascending sort order', () => {
      const { container } = setup({
        data: { series: seriesWithCommonLabels },
        options: { showCommonLabels: true, sortOrder: LogsSortOrder.Ascending },
      });

      expect(container.firstChild?.childNodes[0].textContent).toMatch(/Common labels:common_appcommon_job$/);
    });
    it('does not show common labels when showCommonLabels is set to false', () => {
      setup({ data: { series: seriesWithCommonLabels }, options: { showCommonLabels: false } });

      expect(screen.queryByText(/common labels:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/common_app/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/common_job/i)).not.toBeInTheDocument();
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
    it('shows (no common labels) when showCommonLabels is set to true', () => {
      setup({ data: { series: seriesWithoutCommonLabels }, options: { showCommonLabels: true } });
      expect(screen.getByText(/common labels:/i)).toBeInTheDocument();
      expect(screen.getByText(/(no common labels)/i)).toBeInTheDocument();
    });
    it('does not show common labels when showCommonLabels is set to false', () => {
      setup({ data: { series: seriesWithoutCommonLabels }, options: { showCommonLabels: false } });
      expect(screen.queryByText(/common labels:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/(no common labels)/i)).not.toBeInTheDocument();
    });
  });
});

const setup = (propsOverrides?: {}) => {
  const props = {
    data: {
      error: undefined,
      request: {
        panelId: 4,
        dashboardId: 123,
        app: 'dashboard',
        requestId: 'A',
        timezone: 'browser',
        interval: '30s',
        intervalMs: 30000,
        maxDataPoints: 823,
        targets: [],
        range: {},
      },
      series: [],
      state: LoadingState.Done,
    },
    timeZone: 'utc',
    options: {},
    title: 'Logs panel',
    id: 1,
    ...propsOverrides,
  } as unknown as LogsPanelProps;

  return render(<LogsPanel {...props} />);
};
