import 'whatwg-fetch';
import { render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { Props } from 'react-virtualized-auto-sizer';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { DataFrameJSON } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';

import { TestProvider } from '../../../../../../../test/helpers/TestProvider';
import { backendSrv } from '../../../../../../core/services/backend_srv';

import LokiStateHistory from './LokiStateHistory';

const server = setupServer();

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: Props) =>
    children({
      height: 600,
      scaledHeight: 600,
      scaledWidth: 1,
      width: 1,
    });
});

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });

  server.use(
    http.get('/api/v1/rules/history', () =>
      HttpResponse.json<DataFrameJSON>({
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
  );
});

afterAll(() => {
  server.close();
});

window.HTMLElement.prototype.scrollIntoView = jest.fn();

const ui = {
  loadingIndicator: byText('Loading...'),
  timestampViewer: byRole('list', { name: 'State history by timestamp' }),
  record: byRole('listitem'),
  noRecords: byText('No state transitions have occurred in the last 30 days'),
  timelineChart: byTestId('uplot-main-div'),
};

describe('LokiStateHistory', () => {
  it('should render history records', async () => {
    render(<LokiStateHistory ruleUID="ABC123" />, { wrapper: TestProvider });

    await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

    const timestampViewerElement = ui.timestampViewer.get();
    expect(timestampViewerElement).toBeInTheDocument();

    expect(timestampViewerElement).toHaveTextContent('/api/prometheus/grafana/api/v1/rules');
    expect(timestampViewerElement).toHaveTextContent('/api/live/ws');
    expect(timestampViewerElement).toHaveTextContent('/api/folders/:uid/');
  });

  it('should render timeline chart', async () => {
    render(<LokiStateHistory ruleUID="ABC123" />, { wrapper: TestProvider });

    await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

    expect(ui.timelineChart.get()).toBeInTheDocument();
  });

  it('should render no entries message when no records are returned', async () => {
    server.use(
      http.get('/api/v1/rules/history', () =>
        HttpResponse.json<DataFrameJSON>({ data: { values: [] }, schema: { fields: [] } })
      )
    );

    render(<LokiStateHistory ruleUID="abcd" />, { wrapper: TestProvider });

    await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());

    expect(ui.noRecords.get()).toBeInTheDocument();
  });
});
