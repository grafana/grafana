import { render, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { byRole, byText } from 'testing-library-selector';
import 'whatwg-fetch';

import { DataFrameJSON } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';

import { TestProvider } from '../../../../../../../test/helpers/TestProvider';
import { backendSrv } from '../../../../../../core/services/backend_srv';

import LokiStateHistory from './LokiStateHistory';

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

afterAll(() => {
  server.close();
});

window.HTMLElement.prototype.scrollIntoView = jest.fn();

const ui = {
  loadingIndicator: byText('Loading...'),
  timestampViewer: byRole('list', { name: 'State history by timestamp' }),
  record: byRole('listitem'),
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
});
