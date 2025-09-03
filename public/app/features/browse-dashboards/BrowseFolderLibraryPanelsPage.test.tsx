import { http, HttpResponse } from 'msw';
import { useParams } from 'react-router-dom-v5-compat';
import { render, screen } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';

import BrowseFolderLibraryPanelsPage from './BrowseFolderLibraryPanelsPage';
import { getLibraryElementsResponse } from './fixtures/libraryElements.fixture';
import * as permissions from './permissions';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: jest.fn(),
}));

const [_, { folderA }] = getFolderFixtures();
const mockFolderName = folderA.item.title;
const mockFolderUid = folderA.item.uid;
const mockLibraryElementsResponse = getLibraryElementsResponse(1, {
  folderUid: mockFolderUid,
});

describe('browse-dashboards BrowseFolderLibraryPanelsPage', () => {
  (useParams as jest.Mock).mockReturnValue({ uid: mockFolderUid });
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

  beforeEach(() => {
    config.unifiedAlertingEnabled = true;
    server.use(
      http.get('/api/library-elements', () => {
        return HttpResponse.json({
          result: mockLibraryElementsResponse,
        });
      })
    );

    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => mockPermissions);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
