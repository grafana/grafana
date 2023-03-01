import { render, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getMockDataSources } from 'app/features/datasources/__mocks__';
import * as api from 'app/features/datasources/api';
import { configureStore } from 'app/store/configureStore';

import { getPluginsStateMock } from '../plugins/admin/__mocks__';

import Connections from './Connections';
import { navIndex } from './__mocks__/store.navIndex.mock';
import { ROUTE_BASE_ID, ROUTES } from './constants';

jest.mock('app/core/services/context_srv');
jest.mock('app/features/datasources/api');

const renderPage = (
  path = `/${ROUTE_BASE_ID}`,
  store = configureStore({ navIndex, plugins: getPluginsStateMock([]) })
): RenderResult => {
  locationService.push(path);

  return render(
    <TestProvider store={store}>
      <Connections />
    </TestProvider>
  );
};

describe('Connections', () => {
  const mockDatasources = getMockDataSources(3);

  beforeEach(() => {
    (api.getDataSources as jest.Mock) = jest.fn().mockResolvedValue(mockDatasources);
    (contextSrv.hasPermission as jest.Mock) = jest.fn().mockReturnValue(true);
  });

  test('shows the "Connect data" page by default', async () => {
    renderPage();

    // Data sources group
    expect(await screen.findByText('Data sources')).toBeVisible();

    // Heading
    expect(await screen.findByText('Connect data')).toBeVisible();
    expect(await screen.findByText('Browse and create new connections')).toBeVisible();
  });

  test('shows a landing page for Your connections', async () => {
    renderPage(ROUTES.YourConnections);

    expect(await screen.findByRole('link', { name: 'Datasources' })).toBeVisible();
    expect(await screen.findByText('Manage your existing datasource connections')).toBeVisible();
  });

  test('renders the correct tab even if accessing it with a "sub-url"', async () => {
    renderPage(ROUTES.ConnectData);

    expect(await screen.findByText('Connect data')).toBeVisible();
    expect(await screen.findByText('Browse and create new connections')).toBeVisible();

    // Should not render the "Your datasources" page
    expect(screen.queryByText('Manage your existing datasource connections')).not.toBeInTheDocument();
  });

  test('renders the core "Connect data" page in case there is no standalone plugin page override for it', async () => {
    renderPage(ROUTES.ConnectData);

    // We expect to see no results and "Data sources" as a header (we only have data sources in OSS Grafana at this point)
    expect(await screen.findByText('Data sources')).toBeVisible();
    expect(await screen.findByText('No results matching your query were found.')).toBeVisible();
  });

  test('does not render anything for the "Connect data" page in case it is displayed by a standalone plugin page', async () => {
    // We are overriding the navIndex to have the "Connect data" page registered by a plugin
    const standalonePluginPage = {
      id: 'standalone-plugin-page-/connections/connect-data',
      text: 'Connect data',
      subTitle: 'Browse and create new connections',
      url: '/connections/connect-data',
      pluginId: 'grafana-easystart-app',
    };

    const connections = {
      ...navIndex.connections,
      children: navIndex.connections.children?.map((child) => {
        if (child.id === 'connections-connect-data') {
          return standalonePluginPage;
        }

        return child;
      }),
    };

    const store = configureStore({
      navIndex: { ...navIndex, connections, [standalonePluginPage.id]: standalonePluginPage },
      plugins: getPluginsStateMock([]),
    });

    renderPage(ROUTES.ConnectData, store);

    // We expect not to see the text that would be rendered by the core "Connect data" page
    expect(screen.queryByText('Data sources')).not.toBeInTheDocument();
    expect(screen.queryByText('No results matching your query were found.')).not.toBeInTheDocument();
  });

  test('Your connections redirects to Data sources if it has one child', async () => {
    const navIndexCopy = {
      ...navIndex,
      'connections-your-connections': {
        id: 'connections-your-connections',
        text: 'Your connections',
        subTitle: 'Manage your existing connections',
        url: '/connections/your-connections',
        children: [
          {
            id: 'connections-your-connections-datasources',
            text: 'Datasources',
            subTitle: 'Manage your existing datasource connections',
            url: '/connections/your-connections/datasources',
          },
        ],
      },
    };

    const store = configureStore({
      navIndex: navIndexCopy,
      plugins: getPluginsStateMock([]),
    });

    renderPage(ROUTES.YourConnections, store);

    expect(await screen.findByPlaceholderText('Search by name or type')).toBeInTheDocument();
    expect(await screen.queryByRole('link', { name: 'Datasources' })).toBeNull();
  });
});
