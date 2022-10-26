import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { Provider } from 'react-redux';
import 'whatwg-fetch';
import { BrowserRouter } from 'react-router-dom';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { ListPublicDashboardResponse } from '../types';

import { PublicDashboardListTable, viewPublicDashboardUrl } from './PublicDashboardListTable';

const publicDashboardListResponse: ListPublicDashboardResponse[] = [
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
];

const server = setupServer(
  rest.get('/api/dashboards/public', (_, res, ctx) => res(ctx.status(200), ctx.json(publicDashboardListResponse))),
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

const selectors = e2eSelectors.pages.PublicDashboards;

const renderPublicDashboardTable = async (waitForListRendering?: boolean) => {
  const store = configureStore();

  render(
    <Provider store={store}>
      <BrowserRouter>
        <PublicDashboardListTable />
      </BrowserRouter>
    </Provider>
  );

  waitForListRendering && (await waitForElementToBeRemoved(screen.getByTestId('Spinner'), { timeout: 3000 }));
};

describe('viewPublicDashboardUrl', () => {
  it('has the correct url', () => {
    expect(viewPublicDashboardUrl('abcd')).toEqual('public-dashboards/abcd');
  });
});

describe('Show table', () => {
  it('renders loader spinner while loading', async () => {
    await renderPublicDashboardTable();
    const spinner = screen.getByTestId('Spinner');
    expect(spinner).toBeInTheDocument();

    await waitForElementToBeRemoved(spinner);
  });
  it('renders public dashboard list items', async () => {
    await renderPublicDashboardTable(true);

    const tableBody = screen.getAllByRole('rowgroup')[1];
    expect(within(tableBody).getAllByRole('row')).toHaveLength(publicDashboardListResponse.length);
  });
  it('renders empty list', async () => {
    server.use(
      rest.get('/api/dashboards/public', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json([]));
      })
    );

    await renderPublicDashboardTable(true);

    const tableBody = screen.getAllByRole('rowgroup')[1];
    expect(within(tableBody).queryAllByRole('row')).toHaveLength(0);
  });
  it('renders public dashboards in a good way without trashcan', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(false);
    await renderPublicDashboardItems();

    const tableBody = screen.getAllByRole('rowgroup')[1];
    const tableRows = within(tableBody).getAllByRole('row');

    publicDashboardListResponse.forEach((pd, idx) => {
      const tableRow = tableRows[idx];
      const rowDataCells = within(tableRow).getAllByRole('cell');
      expect(within(rowDataCells[2]).queryByTestId(selectors.trashcanButton)).toBeNull();
    });
  });
  it('renders public dashboards in a good way with trashcan', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
    await renderPublicDashboardItems();

    const tableBody = screen.getAllByRole('rowgroup')[1];
    const tableRows = within(tableBody).getAllByRole('row');

    publicDashboardListResponse.forEach((pd, idx) => {
      const tableRow = tableRows[idx];
      const rowDataCells = within(tableRow).getAllByRole('cell');
      expect(within(rowDataCells[2]).getByTestId(selectors.trashcanButton));
    });
  });
});

describe('Delete public dashboard', () => {
  it('when user does not have public dashboard write permissions, then dashboards are listed without delete button ', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(false);
    await renderPublicDashboardTable(true);

    const tableBody = screen.getAllByRole('rowgroup')[1];
    expect(within(tableBody).queryAllByTestId(selectors.trashcanButton)).toHaveLength(0);
  });
  it('when user has public dashboard write permissions, then dashboards are listed with delete button ', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
    await renderPublicDashboardTable(true);

    const tableBody = screen.getAllByRole('rowgroup')[1];
    expect(within(tableBody).getAllByTestId(selectors.trashcanButton)).toHaveLength(publicDashboardListResponse.length);
  });
  it('user deletes a public dashboard successfully', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
    await renderPublicDashboardTable(true);

    // fireEvent.click(screen.findAllByTestId('Public dashboard'));

    // const tableBody = screen.getAllByRole('rowgroup')[1];
    // expect(within(tableBody).queryAllByTestId(selectors.trashcanButton)).toHaveLength(2);
  });
});

const renderPublicDashboardItems = async () => {
  await renderPublicDashboardTable(true);

  const tableBody = screen.getAllByRole('rowgroup')[1];
  const tableRows = within(tableBody).getAllByRole('row');

  publicDashboardListResponse.forEach((pd, idx) => {
    const tableRow = tableRows[idx];
    const rowDataCells = within(tableRow).getAllByRole('cell');
    expect(rowDataCells).toHaveLength(3);

    expect(within(rowDataCells[0]).getByText(pd.title));
    expect(within(rowDataCells[1]).getByText(pd.isEnabled ? 'enabled' : 'disabled'));
    expect(within(rowDataCells[2]).getByTestId(selectors.linkButton));
    expect(within(rowDataCells[2]).getByTestId(selectors.configButton));
  });
};
