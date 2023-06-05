import 'whatwg-fetch'; // fetch polyfill
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer, SetupServer } from 'msw/node';
import React, { ComponentProps } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import { contextSrv } from 'app/core/core';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { backendSrv } from 'app/core/services/backend_srv';

import BrowseDashboardsPage, { Props } from './BrowseDashboardsPage';
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
      return <div>{props.children({ width: 800, height: 600 })}</div>;
    },
  };
});

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
  let props: Props;
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
      rest.get('/api/search', (_, res, ctx) => {
        return res(ctx.status(200), ctx.json({}));
      }),
      rest.get('/api/search/sorting', (_, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            sortOptions: [],
          })
        );
      })
    );
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    props = {
      ...getRouteComponentProps(),
    };

    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
      return {
        canEditInFolder: true,
        canCreateDashboards: true,
        canCreateFolder: true,
      };
    });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    server.resetHandlers();
  });

  describe('at the root level', () => {
    it('displays "Dashboards" as the page title', async () => {
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
    });

    it('displays a search input', async () => {
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByPlaceholderText('Search for dashboards and folders')).toBeInTheDocument();
    });

    it('shows the "New" button', async () => {
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('button', { name: 'New' })).toBeInTheDocument();
    });

    it('does not show the "New" button if the user does not have permissions', async () => {
      jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
        return {
          canEditInFolder: false,
          canCreateDashboards: false,
          canCreateFolder: false,
        };
      });
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    });

    it('does not show "Folder actions"', async () => {
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
    });

    it('does not show any tabs', async () => {
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();

      expect(screen.queryByRole('tab', { name: 'Tab Dashboards' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Tab Panels' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Tab Alert rules' })).not.toBeInTheDocument();
    });

    it('displays the filters and hides the actions initially', async () => {
      render(<BrowseDashboardsPage {...props} />);
      await screen.findByPlaceholderText('Search for dashboards and folders');

      expect(await screen.findByText('Sort')).toBeInTheDocument();
      expect(await screen.findByText('Filter by tag')).toBeInTheDocument();

      expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('selecting an item hides the filters and shows the actions instead', async () => {
      render(<BrowseDashboardsPage {...props} />);

      const checkbox = await screen.findByTestId(selectors.pages.BrowseDashbards.table.checkbox(dashbdD.item.uid));
      await userEvent.click(checkbox);

      // Check the filters are now hidden
      expect(screen.queryByText('Filter by tag')).not.toBeInTheDocument();
      expect(screen.queryByText('Sort')).not.toBeInTheDocument();

      // Check the actions are now visible
      expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('navigating into a child item resets the selected state', async () => {
      const { rerender } = render(<BrowseDashboardsPage {...props} />);

      const checkbox = await screen.findByTestId(selectors.pages.BrowseDashbards.table.checkbox(folderA.item.uid));
      await userEvent.click(checkbox);

      // Check the actions are now visible
      expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

      const updatedProps = { ...props };
      updatedProps.match.params = { uid: folderA.item.uid };
      rerender(<BrowseDashboardsPage {...updatedProps} />);

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
      props.match.params = { uid: folderA.item.uid };
    });

    it('shows the folder name as the page title', async () => {
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
    });

    it('displays a search input', async () => {
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByPlaceholderText('Search for dashboards and folders')).toBeInTheDocument();
    });

    it('shows the "New" button', async () => {
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('button', { name: 'New' })).toBeInTheDocument();
    });

    it('does not show the "New" button if the user does not have permissions', async () => {
      jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
        return {
          canEditInFolder: false,
          canCreateDashboards: false,
          canCreateFolder: false,
        };
      });
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    });

    it('shows the "Folder actions" button', async () => {
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
    });

    it('does not show the "Folder actions" button if the user does not have permissions', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('heading', { name: folderA.item.title })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
    });

    it('displays all the folder tabs and shows the "Dashboards" tab as selected', async () => {
      render(<BrowseDashboardsPage {...props} />);
      expect(await screen.findByRole('tab', { name: 'Tab Dashboards' })).toBeInTheDocument();
      expect(await screen.findByRole('tab', { name: 'Tab Dashboards' })).toHaveAttribute('aria-selected', 'true');

      expect(await screen.findByRole('tab', { name: 'Tab Panels' })).toBeInTheDocument();
      expect(await screen.findByRole('tab', { name: 'Tab Panels' })).toHaveAttribute('aria-selected', 'false');

      expect(await screen.findByRole('tab', { name: 'Tab Alert rules' })).toBeInTheDocument();
      expect(await screen.findByRole('tab', { name: 'Tab Alert rules' })).toHaveAttribute('aria-selected', 'false');
    });

    it('displays the filters and hides the actions initially', async () => {
      render(<BrowseDashboardsPage {...props} />);
      await screen.findByPlaceholderText('Search for dashboards and folders');

      expect(await screen.findByText('Sort')).toBeInTheDocument();
      expect(await screen.findByText('Filter by tag')).toBeInTheDocument();

      expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('selecting an item hides the filters and shows the actions instead', async () => {
      render(<BrowseDashboardsPage {...props} />);

      const checkbox = await screen.findByTestId(
        selectors.pages.BrowseDashbards.table.checkbox(folderA_folderA.item.uid)
      );
      await userEvent.click(checkbox);

      // Check the filters are now hidden
      expect(screen.queryByText('Filter by tag')).not.toBeInTheDocument();
      expect(screen.queryByText('Sort')).not.toBeInTheDocument();

      // Check the actions are now visible
      expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
  });
});
