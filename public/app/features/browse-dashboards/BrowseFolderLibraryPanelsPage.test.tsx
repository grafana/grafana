import { render as rtlRender, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { SetupServer, setupServer } from 'msw/node';
import { useParams } from 'react-router-dom-v5-compat';
import { TestProvider } from 'test/helpers/TestProvider';

import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';

import BrowseFolderLibraryPanelsPage from './BrowseFolderLibraryPanelsPage';
import { getLibraryElementsResponse } from './fixtures/libraryElements.fixture';
import * as permissions from './permissions';

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
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: jest.fn(),
}));

const mockFolderName = 'myFolder';
const mockFolderUid = '12345';
const mockLibraryElementsResponse = getLibraryElementsResponse(1, {
  folderUid: mockFolderUid,
});

describe('browse-dashboards BrowseFolderLibraryPanelsPage', () => {
  (useParams as jest.Mock).mockReturnValue({ uid: mockFolderUid });
  let server: SetupServer;
  const mockPermissions = {
    canCreateDashboards: true,
    canEditDashboards: true,
    canCreateFolders: true,
    canDeleteFolders: true,
    canEditFolders: true,
    canViewPermissions: true,
    canSetPermissions: true,
    canDeleteDashboards: true,
  };

  beforeAll(() => {
    server = setupServer(
      http.get('/api/folders/:uid', () => {
        return HttpResponse.json({
          title: mockFolderName,
          uid: mockFolderUid,
        });
      }),
      http.get('/api/library-elements', () => {
        return HttpResponse.json({
          result: mockLibraryElementsResponse,
        });
      }),
      http.get('/api/search/sorting', () => {
        return HttpResponse.json({});
      })
    );
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => mockPermissions);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    server.resetHandlers();
  });

  it('displays the folder title', async () => {
    render(<BrowseFolderLibraryPanelsPage />);
    expect(await screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
  });

  it('displays the "Folder actions" button', async () => {
    render(<BrowseFolderLibraryPanelsPage />);
    expect(await screen.findByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
  });

  it('does not display the "Folder actions" button if the user does not have permissions', async () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
      return {
        ...mockPermissions,
        canDeleteFolders: false,
        canEditFolders: false,
        canViewPermissions: false,
        canSetPermissions: false,
      };
    });
    render(<BrowseFolderLibraryPanelsPage />);
    expect(await screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
  });

  it('displays all the folder tabs and shows the "Library panels" tab as selected', async () => {
    render(<BrowseFolderLibraryPanelsPage />);
    expect(await screen.findByRole('tab', { name: 'Dashboards' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Dashboards' })).toHaveAttribute('aria-selected', 'false');

    expect(await screen.findByRole('tab', { name: 'Panels' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Panels' })).toHaveAttribute('aria-selected', 'true');

    expect(await screen.findByRole('tab', { name: 'Alert rules' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Alert rules' })).toHaveAttribute('aria-selected', 'false');
  });

  it('displays the library panels returned by the API', async () => {
    render(<BrowseFolderLibraryPanelsPage />);

    expect(await screen.findByText(mockLibraryElementsResponse.elements[0].name)).toBeInTheDocument();
  });
});
