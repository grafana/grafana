import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { Provider } from 'react-redux';
import 'whatwg-fetch';
import { BrowserRouter } from 'react-router-dom';

import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';

import { PublicDashboardListTable, viewPublicDashboardUrl } from './PublicDashboardListTable';

const server = setupServer(
  rest.get('/api/dashboards/public', (_, res, ctx) =>
    res(
      ctx.status(200),
      ctx.json([
        {
          uid: 'SdZwuCZVz',
          accessToken: 'beeaf92f6ab3467f80b2be922c7741ab',
          title: 'New dashboardasdf',
          dashboardUid: 'iF36Qb6nz',
          isEnabled: false,
        },
        {
          uid: 'EuiEbd3nz',
          accessToken: '8687b0498ccf4babb2f92810d8563b33',
          title: 'New dashboard',
          dashboardUid: 'kFlxbd37k',
          isEnabled: true,
        },
      ])
    )
  ),
  rest.delete('/api/dashboards/:dashboardUid/public/:uid', (_, res, ctx) => res(ctx.status(200)))
);

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => backendSrv,
}));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  jest.restoreAllMocks();
  server.resetHandlers();
});

const renderPublicDashboardTable = () => {
  const store = configureStore();

  render(
    <Provider store={store}>
      <BrowserRouter>
        <PublicDashboardListTable />
      </BrowserRouter>
    </Provider>
  );
};

describe('viewPublicDashboardUrl', () => {
  it('has the correct url', () => {
    expect(viewPublicDashboardUrl('abcd')).toEqual('public-dashboards/abcd');
  });
});

describe('Show table', () => {
  it('renders loader spinner while loading', async () => {
    renderPublicDashboardTable();
    const spinner = screen.getByTestId('Spinner');
    expect(spinner).toBeInTheDocument();

    await waitForElementToBeRemoved(spinner);
  });
  it('renders public dashboard list items', async () => {
    renderPublicDashboardTable();
    await waitForElementToBeRemoved(screen.getByTestId('Spinner'), { timeout: 7000 });

    const tableBody = screen.getAllByRole('rowgroup')[1];
    expect(within(tableBody).getAllByRole('row')).toHaveLength(2);
  });
});
