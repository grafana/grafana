import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { PluginType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { getCatalogPluginMock, getPluginsStateMock } from 'app/features/plugins/admin/__mocks__';
import { CatalogPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types';

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

  test('renders no results if there is no data source plugin in the list', async () => {
    renderPage([getCatalogPluginMock()]);

    expect(screen.queryByText('No results matching your query were found')).toBeInTheDocument();
  });

  test('renders only data source plugins when list is populated', async () => {
    renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);

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

  test('Show request data source and roadmap links', async () => {
    renderPage([getCatalogPluginMock(), mockCatalogDataSourcePlugin]);

    expect(await screen.findByText('Request a new data source')).toBeInTheDocument();
    expect(await screen.findByText('View roadmap')).toBeInTheDocument();
  });
});
