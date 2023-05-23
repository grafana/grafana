import 'whatwg-fetch'; // fetch polyfill
import { render as rtlRender, screen } from '@testing-library/react';
import { rest } from 'msw';
import { SetupServer, setupServer } from 'msw/node';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { LibraryPanel } from '@grafana/schema';
import { contextSrv } from 'app/core/core';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { backendSrv } from 'app/core/services/backend_srv';

import { LibraryElementsSearchResult } from '../library-panels/types';

import BrowseFolderLibraryPanelsPage, { OwnProps } from './BrowseFolderLibraryPanelsPage';
import { wellFormedTree } from './fixtures/dashboardsTreeItem.fixture';

const [_, { folderA }] = wellFormedTree();

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    unifiedAlertingEnabled: true,
  },
}));

const mockLibraryPanelName = 'myLibraryPanel';
const mockLibraryElementsSearchResult: LibraryElementsSearchResult = {
  page: 1,
  perPage: 40,
  totalCount: 1,
  elements: [
    {
      name: mockLibraryPanelName,
      folderUid: folderA.item.uid,
      model: {
        type: 'timeseries',
      },
    } as LibraryPanel,
  ],
};

describe('browse-dashboards BrowseDashboardsPage', () => {
  let props: OwnProps;
  let server: SetupServer;

  beforeAll(() => {
    server = setupServer(
      rest.get('/api/folders/:uid', (_, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            title: folderA.item.title,
            uid: folderA.item.uid,
          })
        );
      }),
      rest.get('/api/library-elements', (_, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json<{ result: LibraryElementsSearchResult }>({
            result: mockLibraryElementsSearchResult,
          })
        );
      }),
      rest.get('/api/search/sorting', (_, res, ctx) => {
        return res(ctx.status(200), ctx.json({}));
      })
    );
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    props = {
      ...getRouteComponentProps({
        match: {
          params: {
            uid: folderA.item.uid,
          },
          isExact: false,
          path: '',
          url: '',
        },
      }),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    server.resetHandlers();
  });

  it('displays the folder title', async () => {
    render(<BrowseFolderLibraryPanelsPage {...props} />);
    expect(await screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
  });

  it('displays the "Folder actions" button', async () => {
    render(<BrowseFolderLibraryPanelsPage {...props} />);
    expect(await screen.findByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
  });

  it('displays all the folder tabs and shows the "Alert rules" tab as selected', async () => {
    render(<BrowseFolderLibraryPanelsPage {...props} />);
    expect(await screen.findByRole('tab', { name: 'Tab Dashboards' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Tab Dashboards' })).toHaveAttribute('aria-selected', 'false');

    expect(await screen.findByRole('tab', { name: 'Tab Panels' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Tab Panels' })).toHaveAttribute('aria-selected', 'true');

    expect(await screen.findByRole('tab', { name: 'Tab Alert rules' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Tab Alert rules' })).toHaveAttribute('aria-selected', 'false');
  });

  it('displays the library panels returned by the API', async () => {
    render(<BrowseFolderLibraryPanelsPage {...props} />);

    expect(await screen.findByText(mockLibraryPanelName)).toBeInTheDocument();
  });
});
