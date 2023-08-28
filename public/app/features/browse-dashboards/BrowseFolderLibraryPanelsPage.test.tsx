import 'whatwg-fetch'; // fetch polyfill
import { render as rtlRender, screen } from '@testing-library/react';
import { rest } from 'msw';
import { SetupServer, setupServer } from 'msw/node';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { contextSrv } from 'app/core/core';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { backendSrv } from 'app/core/services/backend_srv';

import BrowseFolderLibraryPanelsPage, { OwnProps } from './BrowseFolderLibraryPanelsPage';
import { getLibraryElementsResponse } from './fixtures/libraryElements.fixture';

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

const mockFolderName = 'myFolder';
const mockFolderUid = '12345';
const mockLibraryElementsResponse = getLibraryElementsResponse(1, {
  folderUid: mockFolderUid,
});

describe('browse-dashboards BrowseFolderLibraryPanelsPage', () => {
  let props: OwnProps;
  let server: SetupServer;

  beforeAll(() => {
    server = setupServer(
      rest.get('/api/folders/:uid', (_, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            title: mockFolderName,
            uid: mockFolderUid,
          })
        );
      }),
      rest.get('/api/library-elements', (_, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            result: mockLibraryElementsResponse,
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
            uid: mockFolderUid,
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
    expect(await screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
  });

  it('displays the "Folder actions" button', async () => {
    render(<BrowseFolderLibraryPanelsPage {...props} />);
    expect(await screen.findByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
  });

  it('does not display the "Folder actions" button if the user does not have permissions', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    render(<BrowseFolderLibraryPanelsPage {...props} />);
    expect(await screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
  });

  it('displays all the folder tabs and shows the "Library panels" tab as selected', async () => {
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

    expect(await screen.findByText(mockLibraryElementsResponse.elements[0].name)).toBeInTheDocument();
  });
});
