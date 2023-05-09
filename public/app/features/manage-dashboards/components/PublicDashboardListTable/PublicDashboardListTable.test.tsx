import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import 'whatwg-fetch';
import { BrowserRouter } from 'react-router-dom';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { getGrafanaContextMock } from '../../../../../test/mocks/getGrafanaContextMock';
import { ListPublicDashboardResponse } from '../../types';

import { PublicDashboardListTable } from './PublicDashboardListTable';

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

const orphanedDashboardListResponse: ListPublicDashboardResponse[] = [
  {
    uid: 'SdZwuCZVz2',
    accessToken: 'beeaf92f6ab3467f80b2be922c7741ab',
    title: '',
    dashboardUid: '',
    isEnabled: false,
  },
  {
    uid: 'EuiEbd3nz2',
    accessToken: '8687b0498ccf4babb2f92810d8563b33',
    title: '',
    dashboardUid: '',
    isEnabled: true,
  },
];

const server = setupServer(
  rest.get('/api/dashboards/public-dashboards', (_, res, ctx) =>
    res(ctx.status(200), ctx.json(publicDashboardListResponse))
  ),
  rest.delete('/api/dashboards/uid/:dashboardUid/public-dashboards/:uid', (_, res, ctx) => res(ctx.status(200)))
);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
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
  const context = getGrafanaContextMock();

  render(
    <TestProvider grafanaContext={context}>
      <BrowserRouter>
        <PublicDashboardListTable />
      </BrowserRouter>
    </TestProvider>
  );

  waitForListRendering && (await waitForElementToBeRemoved(screen.getAllByTestId('Spinner')[1], { timeout: 3000 }));
};

describe('Show table', () => {
  it('renders loader spinner while loading', async () => {
    await renderPublicDashboardTable();
    const spinner = screen.getAllByTestId('Spinner')[1];
    expect(spinner).toBeInTheDocument();

    await waitForElementToBeRemoved(spinner);
  });
  it('renders public dashboard list items', async () => {
    await renderPublicDashboardTable(true);

    expect(screen.getAllByRole('listitem')).toHaveLength(publicDashboardListResponse.length);
  });
  it('renders empty list', async () => {
    server.use(
      rest.get('/api/dashboards/public-dashboards', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json([]));
      })
    );

    await renderPublicDashboardTable(true);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
  it('renders public dashboards in a good way without trashcan', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(false);

    await renderPublicDashboardTable(true);
    publicDashboardListResponse.forEach((pd, idx) => {
      renderPublicDashboardItemCorrectly(pd, idx, false);
    });
  });
  it('renders public dashboards in a good way with trashcan', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);

    await renderPublicDashboardTable(true);
    publicDashboardListResponse.forEach((pd, idx) => {
      renderPublicDashboardItemCorrectly(pd, idx, true);
    });
  });
});

describe('Delete public dashboard', () => {
  it('when user does not have public dashboard write permissions, then dashboards are listed without delete button', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(false);
    await renderPublicDashboardTable(true);

    expect(screen.queryAllByTestId(selectors.ListItem.trashcanButton)).toHaveLength(0);
  });
  it('when user has public dashboard write permissions, then dashboards are listed with delete button', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
    await renderPublicDashboardTable(true);

    expect(screen.getAllByTestId(selectors.ListItem.trashcanButton)).toHaveLength(publicDashboardListResponse.length);
  });
});

describe('Orphaned public dashboard', () => {
  it('renders orphaned and non orphaned public dashboards items correctly', async () => {
    const response = [...publicDashboardListResponse, ...orphanedDashboardListResponse];
    server.use(
      rest.get('/api/dashboards/public-dashboards', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json(response));
      })
    );
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);

    await renderPublicDashboardTable(true);
    response.forEach((pd, idx) => {
      renderPublicDashboardItemCorrectly(pd, idx, true);
    });
  });
});

const renderPublicDashboardItemCorrectly = (pd: ListPublicDashboardResponse, idx: number, hasWriteAccess: boolean) => {
  const isOrphaned = !pd.dashboardUid;

  const cardItems = screen.getAllByRole('listitem');

  const statusTag = within(cardItems[idx]).getByText(pd.isEnabled ? 'enabled' : 'paused');
  const linkButton = within(cardItems[idx]).getByTestId(selectors.ListItem.linkButton);
  const configButton = within(cardItems[idx]).getByTestId(selectors.ListItem.configButton);
  const trashcanButton = within(cardItems[idx]).queryByTestId(selectors.ListItem.trashcanButton);

  expect(within(cardItems[idx]).getByText(isOrphaned ? 'Orphaned public dashboard' : pd.title)).toBeInTheDocument();
  expect(statusTag).toBeInTheDocument();
  isOrphaned ? expect(statusTag).toHaveStyle('background-color: rgb(110, 110, 110)') : expect(statusTag).toBeEnabled();
  isOrphaned
    ? expect(linkButton).toHaveStyle('pointer-events: none')
    : expect(linkButton).not.toHaveStyle('pointer-events: none');
  isOrphaned
    ? expect(configButton).toHaveStyle('pointer-events: none')
    : expect(configButton).not.toHaveStyle('pointer-events: none');
  hasWriteAccess ? expect(trashcanButton).toBeEnabled() : expect(trashcanButton).toBeNull();
};
