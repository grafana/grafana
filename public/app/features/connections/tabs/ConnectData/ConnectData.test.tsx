import { render, type RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { PluginType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getCatalogPluginMock, getPluginsStateMock } from 'app/features/plugins/admin/mocks/mockHelpers';
import { type CatalogPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types/accessControl';

import { AddNewConnection } from './ConnectData';

jest.mock('app/features/datasources/api');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
}));

const renderPage = (plugins: CatalogPlugin[] = [], path = '/add-new-connection'): RenderResult => {
  locationService.push(path);
  return render(
    <TestProvider storeState={{ plugins: getPluginsStateMock(plugins) }}>
      <AddNewConnection />
    </TestProvider>
  );
};

const mockCatalogDataSourcePlugin = getCatalogPluginMock({
  type: PluginType.datasource,
  name: 'Sample data source',
  id: 'sample-data-source',
});

const mockCatalogAppPlugin = getCatalogPluginMock({
  type: PluginType.app,
  name: 'Sample app',
  id: 'sample-app',
});

describe('Badges', () => {
  test('shows enterprise and deprecated badges for plugins', async () => {
    renderPage([
      getCatalogPluginMock({
        id: 'test-plugin',
        name: 'test Plugin',
        type: PluginType.datasource,
        isEnterprise: true,
      }),
      getCatalogPluginMock({
        id: 'test2-plugin',
        name: 'test2 Plugin',
        type: PluginType.datasource,
        isDeprecated: true,
      }),
    ]);
    await waitFor(() => {
      expect(screen.queryByText('test Plugin')).toBeInTheDocument();
    });
    expect(screen.queryByText('Enterprise')).toBeVisible();
    expect(screen.queryByText('Deprecated')).toBeVisible();
  });
});

describe('Add new connection', () => {
  test('renders no results if the plugins list is empty', async () => {
    renderPage();

    expect(screen.queryByText('No results matching your query were found')).toBeInTheDocument();
  });

  test('renders no results if there are no datasource or app plugins in the list', async () => {
    renderPage([getCatalogPluginMock({ type: PluginType.panel })]);

    expect(screen.queryByText('No results matching your query were found')).toBeInTheDocument();
  });

  test('renders only data source plugins when list is populated', async () => {
    renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);

    expect(await screen.findByText('Sample data source')).toBeVisible();
  });

  test('renders app plugins when list is populated', async () => {
    renderPage([getCatalogPluginMock(), mockCatalogAppPlugin]);

    expect(await screen.findByText('Sample app')).toBeVisible();
  });

  test('renders app plugin and datasource plugin when list is populated', async () => {
    renderPage([getCatalogPluginMock(), mockCatalogAppPlugin, mockCatalogDataSourcePlugin]);

    expect(await screen.findByText('Sample app')).toBeVisible();
    expect(await screen.findByText('Sample data source')).toBeVisible();
  });

  test('should list plugins with update when filtering by update', async () => {
    const { queryByText } = renderPage(
      [
        getCatalogPluginMock({
          id: 'plugin-1',
          name: 'Plugin 1',
          isInstalled: true,
          hasUpdate: true,
          type: PluginType.datasource,
        }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
        getCatalogPluginMock({
          id: 'plugin-3',
          name: 'Plugin 3',
          isInstalled: true,
          hasUpdate: true,
          type: PluginType.datasource,
        }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isCore: true }),
      ],
      '/add-new-connection?filterBy=has-update'
    );

    await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());
    expect(queryByText('Plugin 3')).toBeInTheDocument();

    expect(queryByText('Plugin 2')).not.toBeInTheDocument();
    expect(queryByText('Plugin 4')).not.toBeInTheDocument();
  });

  test('renders card if search term matches', async () => {
    renderPage(
      [
        getCatalogPluginMock({ type: PluginType.datasource, id: 'test1', name: 'test33' }),
        getCatalogPluginMock({ id: 'test2', type: PluginType.datasource, name: 'querymatches' }),
      ],
      '/add-new-connection?filterBy=all&sortBy=nameAsc&search=querymatches'
    );
    expect(await screen.findByText('querymatches')).toBeVisible();
  });

  test('renders no results if search term does not match', async () => {
    renderPage(
      [
        getCatalogPluginMock({ type: PluginType.datasource, id: 'test1', name: 'test33' }),
        getCatalogPluginMock({ id: 'test2', type: PluginType.datasource, name: 'querymatches' }),
      ],
      '/add-new-connection?filterBy=all&sortBy=nameAsc&search=dfvdfv'
    );

    expect(await screen.findByText('No results matching your query were found')).toBeVisible();
  });

  test('shows a "No access" modal if the user does not have permissions to create datasources', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockImplementation((permission: string) => {
      if (permission === AccessControlAction.DataSourcesCreate) {
        return false;
      }

      return true;
    });

    renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);
    const exampleSentenceInModal = 'Editors cannot add new connections.';

    // Should not show the modal by default
    expect(screen.queryByText(new RegExp(exampleSentenceInModal))).not.toBeInTheDocument();

    // Should show the modal if the user has no permissions
    await userEvent.click(await screen.findByText('Sample data source'));
    expect(screen.queryByText(new RegExp(exampleSentenceInModal))).toBeInTheDocument();
  });
});

describe('Group by', () => {
  test('renders category headers when grouped by category and category is set', async () => {
    renderPage(
      [
        getCatalogPluginMock({ id: 'ds-1', name: 'DS 1', type: PluginType.datasource, category: 'tsdb' }),
        getCatalogPluginMock({ id: 'ds-2', name: 'DS 2', type: PluginType.datasource, category: 'logging' }),
      ],
      '/add-new-connection?groupBy=category'
    );

    expect(await screen.findByText('Time series databases')).toBeVisible();
    expect(screen.getByText('Logging & document databases')).toBeVisible();
  });

  test('plugins without category appear under Others when grouped by category', async () => {
    renderPage(
      [getCatalogPluginMock({ id: 'ds-1', name: 'No Category DS', type: PluginType.datasource })],
      '/add-new-connection?groupBy=category'
    );

    expect(await screen.findByText('No Category DS')).toBeVisible();
    expect(screen.getByText('Others')).toBeVisible();
  });
});

describe('Category filter', () => {
  const pluginsWithCategories = [
    getCatalogPluginMock({ id: 'ds-tsdb', name: 'TSDB Plugin', type: PluginType.datasource, category: 'tsdb' }),
    getCatalogPluginMock({ id: 'ds-sql', name: 'SQL Plugin', type: PluginType.datasource, category: 'sql' }),
    getCatalogPluginMock({ id: 'ds-cloud', name: 'Cloud Plugin', type: PluginType.datasource, category: 'cloud' }),
  ];

  test('shows all plugins when categoryFilter is all', async () => {
    renderPage(pluginsWithCategories, '/add-new-connection?categoryFilter=all');

    expect(await screen.findByText('TSDB Plugin')).toBeVisible();
    expect(screen.getByText('SQL Plugin')).toBeVisible();
    expect(screen.getByText('Cloud Plugin')).toBeVisible();
  });

  test('shows only matching plugins when categoryFilter is set', async () => {
    renderPage(pluginsWithCategories, '/add-new-connection?categoryFilter=tsdb');

    expect(await screen.findByText('TSDB Plugin')).toBeVisible();
    expect(screen.queryByText('SQL Plugin')).not.toBeInTheDocument();
    expect(screen.queryByText('Cloud Plugin')).not.toBeInTheDocument();
  });
});

describe('Type filter', () => {
  const mixedPlugins = [
    getCatalogPluginMock({ id: 'ds-1', name: 'My DataSource', type: PluginType.datasource, category: 'tsdb' }),
    getCatalogPluginMock({ id: 'app-1', name: 'My App', type: PluginType.app, category: 'cloud' }),
  ];

  test('shows only datasources when typeFilter is datasource in category view', async () => {
    renderPage(mixedPlugins, '/add-new-connection?groupBy=category&typeFilter=datasource');

    expect(await screen.findByText('My DataSource')).toBeVisible();
    expect(screen.queryByText('My App')).not.toBeInTheDocument();
  });

  test('shows only apps when typeFilter is app in category view', async () => {
    renderPage(mixedPlugins, '/add-new-connection?groupBy=category&typeFilter=app');

    expect(await screen.findByText('My App')).toBeVisible();
    expect(screen.queryByText('My DataSource')).not.toBeInTheDocument();
  });
});

describe('Filter sidebar', () => {
  test('renders filter button in sidebar toolbar', async () => {
    renderPage([mockCatalogDataSourcePlugin]);

    expect(await screen.findByLabelText('Filters')).toBeVisible();
  });

  test('opens filter pane when filter button is clicked', async () => {
    renderPage([mockCatalogDataSourcePlugin]);

    await userEvent.click(await screen.findByLabelText('Filters'));

    expect(screen.getByLabelText('Filter by category')).toBeVisible();
    expect(screen.getByText('State')).toBeVisible();
    expect(screen.getByText('Sort')).toBeVisible();
  });

  test('reset button is disabled when no filters are active', async () => {
    renderPage([mockCatalogDataSourcePlugin]);

    await userEvent.click(await screen.findByLabelText('Filters'));

    expect(screen.getByLabelText('Reset filters')).toBeDisabled();
  });

  test('reset button is enabled when filters are active', async () => {
    renderPage([mockCatalogDataSourcePlugin], '/add-new-connection?filterBy=installed');

    await userEvent.click(await screen.findByLabelText('Filters'));

    expect(screen.getByLabelText('Reset filters')).toBeEnabled();
  });
});
