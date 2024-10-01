import { screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render } from 'test/test-utils';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { PublicDashboardListResponse, PublicDashboardListWithPaginationResponse } from '../../types';

import { PublicDashboardListTable } from './PublicDashboardListTable';

const publicDashboardListResponse: PublicDashboardListResponse[] = [
  {
    uid: 'SdZwuCZVz',
    accessToken: 'beeaf92f6ab3467f80b2be922c7741ab',
    title: 'New dashboardasdf',
    dashboardUid: 'iF36Qb6nz',
    isEnabled: false,
    slug: 'new-dashboardasdf',
  },
  {
    uid: 'EuiEbd3nz',
    accessToken: '8687b0498ccf4babb2f92810d8563b33',
    title: 'New dashboard',
    dashboardUid: 'kFlxbd37k',
    isEnabled: true,
    slug: 'new-dashboard',
  },
];

const paginationResponse: Omit<PublicDashboardListWithPaginationResponse, 'publicDashboards'> = {
  page: 1,
  perPage: 50,
  totalCount: 50,
};

const server = setupServer(
  http.get('/api/dashboards/public-dashboards', () =>
    HttpResponse.json({
      ...paginationResponse,
      publicDashboards: publicDashboardListResponse,
    })
  ),
  http.delete('/api/dashboards/uid/:dashboardUid/public-dashboards/:uid', () => HttpResponse.json({}))
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
  render(<PublicDashboardListTable />);

  waitForListRendering && (await waitForElementToBeRemoved(screen.getAllByTestId('Spinner')[0], { timeout: 3000 }));
};

describe('Show table', () => {
  it('renders loader spinner while loading', async () => {
    await renderPublicDashboardTable();
    const spinner = screen.getAllByTestId('Spinner')[0];
    expect(spinner).toBeInTheDocument();

    await waitForElementToBeRemoved(spinner);
  });
  it('renders public dashboard list items', async () => {
    await renderPublicDashboardTable(true);

    expect(screen.getAllByRole('listitem')).toHaveLength(publicDashboardListResponse.length);
  });
  it('renders empty list', async () => {
    const emptyListRS: PublicDashboardListWithPaginationResponse = {
      publicDashboards: [],
      totalCount: 0,
      page: 1,
      perPage: 50,
    };

    server.use(
      http.get('/api/dashboards/public-dashboards', () => {
        return HttpResponse.json(emptyListRS);
      })
    );

    await renderPublicDashboardTable(true);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
  it('renders public dashboards in a good way without trashcan', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    await renderPublicDashboardTable(true);
    publicDashboardListResponse.forEach((pd, idx) => {
      renderPublicDashboardItemCorrectly(pd, idx, false);
    });
  });
  it('renders public dashboards in a good way with trashcan', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    await renderPublicDashboardTable(true);
    publicDashboardListResponse.forEach((pd, idx) => {
      renderPublicDashboardItemCorrectly(pd, idx, true);
    });
  });
});

describe('Delete public dashboard', () => {
  it('when user does not have public dashboard write permissions, then dashboards are listed without delete button', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    await renderPublicDashboardTable(true);

    expect(screen.queryAllByTestId(selectors.ListItem.trashcanButton)).toHaveLength(0);
  });
  it('when user has public dashboard write permissions, then dashboards are listed with delete button', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    await renderPublicDashboardTable(true);

    expect(screen.getAllByTestId(selectors.ListItem.trashcanButton)).toHaveLength(publicDashboardListResponse.length);
  });
});

const renderPublicDashboardItemCorrectly = (pd: PublicDashboardListResponse, idx: number, hasWriteAccess: boolean) => {
  const isOrphaned = !pd.dashboardUid;

  const cardItems = screen.getAllByRole('listitem');

  const linkButton = within(cardItems[idx]).getByTestId(selectors.ListItem.linkButton);
  const configButton = within(cardItems[idx]).getByTestId(selectors.ListItem.configButton);
  const trashcanButton = within(cardItems[idx]).queryByTestId(selectors.ListItem.trashcanButton);

  expect(within(cardItems[idx]).getByText(isOrphaned ? 'Orphaned public dashboard' : pd.title)).toBeInTheDocument();
  isOrphaned
    ? expect(linkButton).toHaveStyle('pointer-events: none')
    : expect(linkButton).not.toHaveStyle('pointer-events: none');
  isOrphaned
    ? expect(configButton).toHaveStyle('pointer-events: none')
    : expect(configButton).not.toHaveStyle('pointer-events: none');
  hasWriteAccess ? expect(trashcanButton).toBeEnabled() : expect(trashcanButton).toBeNull();
};
