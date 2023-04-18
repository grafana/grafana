import { render, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { byTestId, byText } from 'testing-library-selector';
import 'whatwg-fetch';

import { createTheme, DataFrameJSON, FieldType } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';

import { TestProvider } from '../../../../../../../test/helpers/TestProvider';
import { backendSrv } from '../../../../../../core/services/backend_srv';

import LokiStateHistory, { logRecordsToDataFrame } from './LokiStateHistory';
import { LogRecord } from './common';

const server = setupServer();

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });

  server.use(
    rest.get('/api/v1/rules/history', (req, res, ctx) =>
      res(
        ctx.json<DataFrameJSON>({
          data: {
            values: [
              [1681739580000, 1681739580000, 1681739580000],
              [
                {
                  previous: 'Normal',
                  current: 'Pending',
                  values: {
                    B: 0.010344684900897919,
                    C: 1,
                  },
                  labels: {
                    handler: '/api/prometheus/grafana/api/v1/rules',
                  },
                },
                {
                  previous: 'Normal',
                  current: 'Pending',
                  values: {
                    B: 0.010344684900897919,
                    C: 1,
                  },
                  dashboardUID: '',
                  panelID: 0,
                  labels: {
                    handler: '/api/live/ws',
                  },
                },
                {
                  previous: 'Normal',
                  current: 'Pending',
                  values: {
                    B: 0.010344684900897919,
                    C: 1,
                  },
                  labels: {
                    handler: '/api/folders/:uid/',
                  },
                },
              ],
            ],
          },
        })
      )
    )
  );
});

// beforeEach(() => {
//   server.resetHandlers();
// });

afterAll(() => {
  server.close();
});

window.HTMLElement.prototype.scrollIntoView = jest.fn();

const ui = {
  loadingIndicator: byText('Loading...'),
  timestampViewer: byTestId('history-by-timestamp-viewer'),
};

describe('LokiStateHistory', () => {
  it('should render history records', async () => {
    render(<LokiStateHistory ruleUID="ABC123" />, { wrapper: TestProvider });

    await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

    expect(ui.timestampViewer.get()).toBeInTheDocument();
  });

  describe('logRecordsToDataFrame', () => {
    const theme = createTheme();

    it('should convert instance history records into a data frame', () => {
      const instanceLabels = { foo: 'bar', severity: 'critical', cluster: 'dev-us' };
      const records: LogRecord[] = [
        {
          timestamp: 1000000,
          line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels },
        },
      ];

      const frame = logRecordsToDataFrame(JSON.stringify(instanceLabels), records, [], theme);

      expect(frame.fields).toHaveLength(2);

      const timeField = frame.fields[0];
      const stateChangeField = frame.fields[1];
      const timeFieldValues = timeField.values.toArray();
      const stateChangeFieldValues = stateChangeField.values.toArray();

      expect(timeField.name).toBe('time');
      expect(timeField.type).toBe(FieldType.time);

      expect(stateChangeField.name).toBe('state');
      expect(stateChangeField.type).toBe(FieldType.string);
      // There should be an artificial element at the end meaning Date.now()
      // It exist to draw the state change from when it happened to the current time
      expect(timeFieldValues).toHaveLength(2);
      expect(timeFieldValues[0]).toBe(1000000);

      expect(stateChangeFieldValues).toHaveLength(2);
      expect(stateChangeFieldValues).toEqual(['Alerting', 'Alerting']);
    });

    it('should configure value to color mappings', () => {
      const instanceLabels = { foo: 'bar', severity: 'critical', cluster: 'dev-us' };
      const records: LogRecord[] = [
        {
          timestamp: 1000000,
          line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels },
        },
      ];

      const frame = logRecordsToDataFrame(JSON.stringify(instanceLabels), records, [], theme);

      const stateField = frame.fields[1];
      expect(stateField.config.mappings).toHaveLength(1);
      expect(stateField.config.mappings![0].options).toMatchObject({
        Alerting: {
          color: theme.colors.error.main,
        },
        Pending: {
          color: theme.colors.warning.main,
        },
        Normal: {
          color: theme.colors.success.main,
        },
        NoData: {
          color: theme.colors.info.main,
        },
      });
    });

    it('should return correct data frame summary', () => {
      const instanceLabels = { foo: 'bar', severity: 'critical', cluster: 'dev-us' };
      const records: LogRecord[] = [
        {
          timestamp: 1000000,
          line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels },
        },
      ];

      const frame = logRecordsToDataFrame(JSON.stringify(instanceLabels), records, [], theme);

      expect(frame.fields).toHaveLength(2);
      expect(frame).toHaveLength(2);
    });

    it('should have only unique labels in display name', () => {
      const instanceLabels = { foo: 'bar', severity: 'critical', cluster: 'dev-us' };
      const records: LogRecord[] = [
        {
          timestamp: 1000000,
          line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels },
        },
      ];

      const frame = logRecordsToDataFrame(
        JSON.stringify(instanceLabels),
        records,
        [
          ['foo', 'bar'],
          ['cluster', 'dev-us'],
        ],
        theme
      );

      expect(frame.fields[1].config.displayName).toBe('severity=critical');
    });
  });
});
