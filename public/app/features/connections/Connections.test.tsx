import { render, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { getMockDataSources } from 'app/features/datasources/__mocks__';
import * as api from 'app/features/datasources/api';
import { configureStore } from 'app/store/configureStore';

import { getPluginsStateMock } from '../plugins/admin/__mocks__';

import Connections from './Connections';
import { navIndex } from './__mocks__/store.navIndex.mock';
import { ROUTE_BASE_ID, ROUTES } from './constants';

jest.mock('app/features/datasources/api');

const renderPage = (
  path = `/${ROUTE_BASE_ID}`,
  store = configureStore({ navIndex, plugins: getPluginsStateMock([]) })
): RenderResult => {
  locationService.push(path);

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <Connections />
      </Router>
    </Provider>
  );
};

describe('Connections', () => {
  const mockDatasources = getMockDataSources(3);

  beforeEach(() => {
    (api.getDataSources as jest.Mock) = jest.fn().mockResolvedValue(mockDatasources);
  });

  test('shows the "Data sources" page by default', async () => {
    renderPage();

    expect(await screen.findByText('Datasources')).toBeVisible();
    expect(await screen.findByText('Manage your existing datasource connections')).toBeVisible();
    expect(await screen.findByRole('link', { name: /add data source/i })).toBeVisible();
    expect(await screen.findByText(mockDatasources[0].name)).toBeVisible();
  });

  test('renders the correct tab even if accessing it with a "sub-url"', async () => {
    renderPage(ROUTES.ConnectData);

    expect(await screen.findByText('Connect data')).toBeVisible();
    expect(await screen.findByText('Browse and create new connections')).toBeVisible();

    // Should not render the "Your datasources" page
    expect(screen.queryByText('Manage your existing datasource connections')).not.toBeInTheDocument();
  });

  test('renders the "Connect data" page using a plugin in case it is a standalone plugin page', async () => {
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

    // We expect not to see the same text as if it was rendered by core.
    expect(screen.queryByText('No results matching your query were found.')).not.toBeInTheDocument();
  });
});
