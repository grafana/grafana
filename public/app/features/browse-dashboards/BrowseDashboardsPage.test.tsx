import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer, SetupServer } from 'msw/node';
import { ComponentProps } from 'react';
import * as React from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import AutoSizer from 'react-virtualized-auto-sizer';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';

import BrowseDashboardsPage from './BrowseDashboardsPage';
import { wellFormedTree } from './fixtures/dashboardsTreeItem.fixture';
import * as permissions from './permissions';
const [mockTree, { dashbdD, folderA, folderA_folderA }] = wellFormedTree();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    unifiedAlertingEnabled: true,
  },
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: ComponentProps<typeof AutoSizer>) {
      return (
        <div>
          {props.children({
            width: 800,
            scaledWidth: 800,
            scaledHeight: 600,
            height: 600,
          })}
        </div>
      );
    },
  };
});

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: jest.fn().mockReturnValue({}),
}));

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  const { rerender } = rtlRender(
    <TestProvider
      storeState={{
        navIndex: {
          'dashboards/browse': {
            text: 'Dashboards',
            id: 'dashboards/browse',
          },
        },
      }}
    >
      {ui}
    </TestProvider>,
    options
  );

  const wrappedRerender = (ui: React.ReactElement) => {
    rerender(
      <TestProvider
        storeState={{
          navIndex: {
            'dashboards/browse': {
              text: 'Dashboards',
              id: 'dashboards/browse',
            },
          },
        }}
      >
        {ui}
      </TestProvider>
    );
  };
  return {
    rerender: wrappedRerender,
  };
}

jest.mock('app/features/browse-dashboards/api/services', () => {
  const orig = jest.requireActual('app/features/browse-dashboards/api/services');

  return {
    ...orig,
    listFolders(parentUID?: string) {
      const childrenForUID = mockTree
        .filter((v) => v.item.kind === 'folder' && v.item.parentUID === parentUID)
        .map((v) => v.item);

      return Promise.resolve(childrenForUID);
    },

    listDashboards(parentUID?: string) {
      const childrenForUID = mockTree
        .filter((v) => v.item.kind === 'dashboard' && v.item.parentUID === parentUID)
        .map((v) => v.item);

      return Promise.resolve(childrenForUID);
    },
  };
});

describe('browse-dashboards BrowseDashboardsPage', () => {
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
          title: folderA.item.title,
          uid: folderA.item.uid,
        });
      }),
      http.get('/api/search', () => {
        return HttpResponse.json({});
      }),
      http.get('/api/search/sorting', () => {
        return HttpResponse.json({
          sortOptions: [],
        });
      }),
      http.get('/apis/provisioning.grafana.app/v0alpha1/namespaces/default/settings', () => {
        return HttpResponse.json({
          items: [],
        });
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
    // Reset permissions back to defaults
    Object.assign(mockPermissions, {
      canCreateDashboards: true,
      canEditDashboards: true,
      canCreateFolders: true,
      canDeleteFolders: true,
      canEditFolders: true,
      canViewPermissions: true,
      canSetPermissions: true,
      canDeleteDashboards: true,
    });
    jest.restoreAllMocks();
    server.resetHandlers();
  });

  describe('at the root level', () => {
    it('displays "Dashboards" as the page title', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
    });

    it('displays a search input', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByPlaceholderText('Search for dashboards and folders')).toBeInTheDocument();
    });

    it('shows the "New" button', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('button', { name: 'New' })).toBeInTheDocument();
    });

    it('does not show the "New" button if the user does not have permissions', async () => {
      mockPermissions.canCreateDashboards = false;
      mockPermissions.canCreateFolders = false;
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    });

    it('does not show "Folder actions"', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
    });

    it('does not show an "Edit title" button', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit title' })).not.toBeInTheDocument();
    });

    it('does not show any tabs', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();

      expect(screen.queryByRole('tab', { name: 'Dashboards' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Panels' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Alert rules' })).not.toBeInTheDocument();
    });

    it('displays the filters and hides the actions initially', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      await screen.findByPlaceholderText('Search for dashboards and folders');

      expect(await screen.findByText('Sort')).toBeInTheDocument();
      expect(await screen.findByText('Filter by tag')).toBeInTheDocument();

      expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('selecting an item hides the filters and shows the actions instead', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);

      const checkbox = await screen.findByTestId(selectors.pages.BrowseDashboards.table.checkbox(dashbdD.item.uid));
      await userEvent.click(checkbox);

      // Check the filters are now hidden
      expect(screen.queryByText('Filter by tag')).not.toBeInTheDocument();
      expect(screen.queryByText('Sort')).not.toBeInTheDocument();

      // Check the actions are now visible
      expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('navigating into a child item resets the selected state', async () => {
      const { rerender } = render(<BrowseDashboardsPage queryParams={{}} />);

      const checkbox = await screen.findByTestId(selectors.pages.BrowseDashboards.table.checkbox(folderA.item.uid));
      await userEvent.click(checkbox);

      // Check the actions are now visible
      expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

      (useParams as jest.Mock).mockReturnValue({ uid: folderA.item.uid });
      rerender(<BrowseDashboardsPage queryParams={{}} />);

      // Check the filters are now visible again
      expect(await screen.findByText('Filter by tag')).toBeInTheDocument();
      expect(await screen.findByText('Sort')).toBeInTheDocument();

      // Check the actions are no longer visible
      expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });
  });

  describe('for a child folder', () => {
    beforeEach(() => {
      (useParams as jest.Mock).mockReturnValue({ uid: folderA.item.uid });
    });

    it('shows the folder name as the page title', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
    });

    it('displays a search input', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByPlaceholderText('Search for dashboards and folders')).toBeInTheDocument();
    });

    it('shows the "New" button', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('button', { name: 'New' })).toBeInTheDocument();
    });

    it('does not show the "New" button if the user does not have permissions', async () => {
      mockPermissions.canCreateDashboards = false;
      mockPermissions.canCreateFolders = false;
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    });

    it('shows the "Folder actions" button', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
    });

    it('does not show the "Folder actions" button if the user does not have permissions', async () => {
      mockPermissions.canDeleteFolders = false;
      mockPermissions.canEditFolders = false;
      mockPermissions.canSetPermissions = false;
      mockPermissions.canViewPermissions = false;
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
    });

    it('shows an "Edit title" button', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('button', { name: 'Edit title' })).toBeInTheDocument();
    });

    it('does not show the "Edit title" button if the user does not have permissions', async () => {
      mockPermissions.canEditFolders = false;
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit title' })).not.toBeInTheDocument();
    });

    it('displays all the folder tabs and shows the "Dashboards" tab as selected', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      expect(await screen.findByRole('tab', { name: 'Dashboards' })).toBeInTheDocument();
      expect(await screen.findByRole('tab', { name: 'Dashboards' })).toHaveAttribute('aria-selected', 'true');

      expect(await screen.findByRole('tab', { name: 'Panels' })).toBeInTheDocument();
      expect(await screen.findByRole('tab', { name: 'Panels' })).toHaveAttribute('aria-selected', 'false');

      expect(await screen.findByRole('tab', { name: 'Alert rules' })).toBeInTheDocument();
      expect(await screen.findByRole('tab', { name: 'Alert rules' })).toHaveAttribute('aria-selected', 'false');
    });

    it('displays the filters and hides the actions initially', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);
      await screen.findByPlaceholderText('Search for dashboards and folders');

      expect(await screen.findByText('Sort')).toBeInTheDocument();
      expect(await screen.findByText('Filter by tag')).toBeInTheDocument();

      expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('selecting an item hides the filters and shows the actions instead', async () => {
      render(<BrowseDashboardsPage queryParams={{}} />);

      const checkbox = await screen.findByTestId(
        selectors.pages.BrowseDashboards.table.checkbox(folderA_folderA.item.uid)
      );
      await userEvent.click(checkbox);

      // Check the filters are now hidden
      expect(screen.queryByText('Filter by tag')).not.toBeInTheDocument();
      expect(screen.queryByText('Sort')).not.toBeInTheDocument();

      // Check the actions are now visible
      expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('should not show checkbox for folder when user has dashboards:write but lacks folder edit permissions', async () => {
      mockPermissions.canCreateFolders = false;
      mockPermissions.canDeleteFolders = false;
      mockPermissions.canEditFolders = false;
      mockPermissions.canSetPermissions = false;
      mockPermissions.canViewPermissions = false;
      mockPermissions.canDeleteDashboards = false;

      render(<BrowseDashboardsPage queryParams={{}} />);

      await waitFor(() => {
        const checkbox = screen.queryByTestId(
          selectors.pages.BrowseDashboards.table.checkbox(folderA_folderA.item.uid)
        );

        expect(checkbox).not.toBeInTheDocument();
      });
    });

    it('should not show checkbox for folder when user has folder:write but lacks folder delete permissions', async () => {
      mockPermissions.canCreateFolders = false;
      mockPermissions.canDeleteFolders = false;
      mockPermissions.canEditFolders = true;
      mockPermissions.canSetPermissions = false;
      mockPermissions.canViewPermissions = false;

      render(<BrowseDashboardsPage queryParams={{}} />);

      await waitFor(() => {
        const checkbox = screen.queryByTestId(
          selectors.pages.BrowseDashboards.table.checkbox(folderA_folderA.item.uid)
        );

        expect(checkbox).not.toBeInTheDocument();
      });
    });

    it('should show checkbox for folder when user has folder:write and folder delete permissions', async () => {
      mockPermissions.canCreateFolders = false;
      mockPermissions.canEditDashboards = false;
      mockPermissions.canDeleteDashboards = false;
      mockPermissions.canSetPermissions = false;
      mockPermissions.canViewPermissions = false;
      mockPermissions.canDeleteFolders = true;
      mockPermissions.canEditFolders = true;

      render(<BrowseDashboardsPage queryParams={{}} />);

      const checkbox = await screen.findByTestId(
        selectors.pages.BrowseDashboards.table.checkbox(folderA_folderA.item.uid)
      );

      expect(checkbox).toBeInTheDocument();
    });
  });
});
