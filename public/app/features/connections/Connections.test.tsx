import { RenderResult, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';

import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import * as api from 'app/features/datasources/api';
import { getMockDataSources } from 'app/features/datasources/mocks/dataSourcesMocks';
import { configureStore } from 'app/store/configureStore';

import { getPluginsStateMock } from '../plugins/admin/mocks/mockHelpers';

import Connections from './Connections';
import { ROUTES } from './constants';
import { navIndex } from './mocks/store.navIndex.mock';

jest.mock('app/core/services/context_srv');
jest.mock('app/features/datasources/api');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
}));

const renderPage = (
  path: string = ROUTES.Base,
  store = configureStore({ navIndex, plugins: getPluginsStateMock([]) })
): RenderResult => {
  return render(
    <Routes>
      <Route path={`${ROUTES.Base}/*`} element={<Connections />} />
    </Routes>,
    {
      store,
      historyOptions: { initialEntries: [path] },
    }
  );
};

describe('Connections', () => {
  const mockDatasources = getMockDataSources(3);

  beforeEach(() => {
    (api.getDataSources as jest.Mock) = jest.fn().mockResolvedValue(mockDatasources);
    (contextSrv.hasPermission as jest.Mock) = jest.fn().mockReturnValue(true);
  });

  test('shows the "Connections Homepage" page by default when edition is Cloud', async () => {
    config.buildInfo.edition = GrafanaEdition.Enterprise;
    renderPage();

    // Add new connection card
    expect(await screen.findByText('Add new connection')).toBeVisible();
    expect(await screen.findByText('Collector')).toBeVisible();
    expect(await screen.findByText('Data sources')).toBeVisible();
    expect(await screen.findByText('Integrations')).toBeVisible();
    expect(await screen.findByText('Private data source connect')).toBeVisible();

    // Heading
    expect(await screen.findByText('Welcome to Connections')).toBeVisible();
    expect(
      await screen.findByText(
        'Connect your infrastructure to Grafana Cloud using data sources, integrations and apps. Use this page to add to manage everything from data ingestion to private connections and telemetry pipelines.'
      )
    ).toBeVisible();
  });

  test('shows the OSS "Connections Homepage" page by default when edition is OpenSource', async () => {
    config.buildInfo.edition = GrafanaEdition.OpenSource;
    renderPage();

    // Add new connection card
    expect(await screen.findByText('Add new connection')).toBeVisible();
    expect(await screen.findByText('View configured data sources')).toBeVisible();

    // Heading
    expect(await screen.findByText('Welcome to Connections')).toBeVisible();
    expect(
      await screen.findByText(
        'Manage your data source connections in one place. Use this page to add a new data source or manage your existing connections.'
      )
    ).toBeVisible();
  });

  test('renders the correct tab even if accessing it with a "sub-url"', async () => {
    renderPage(ROUTES.AddNewConnection);

    expect(await screen.findByText('Add new connection')).toBeVisible();
    expect(await screen.findByText('Browse and create new connections')).toBeVisible();

    // Should not render the "datasources" page
    expect(screen.queryByText('Manage your existing datasource connections')).not.toBeInTheDocument();
  });

  test('renders the core "Add new connection" page in case there is no standalone plugin page override for it', async () => {
    renderPage(ROUTES.AddNewConnection);

    // We expect to see no results and "Data sources" as a header (we only have data sources in OSS Grafana at this point)
    expect(await screen.findByText('Data sources')).toBeVisible();
    expect(await screen.findByText('No results matching your query were found')).toBeVisible();
  });

  test('does not render anything for the "Add new connection" page in case it is displayed by a standalone plugin page', async () => {
    // We are overriding the navIndex to have the "Add new connection" page registered by a plugin
    const standalonePluginPage = {
      id: 'standalone-plugin-page-/connections/add-new-connection',
      text: 'Add new connection',
      subTitle: 'Browse and create new connections',
      url: '/connections/add-new-connection',
      pluginId: 'grafana-easystart-app',
    };

    const connections = {
      ...navIndex.connections,
      children: navIndex.connections.children?.map((child) => {
        if (child.id === 'connections-add-new-connection') {
          return standalonePluginPage;
        }

        return child;
      }),
    };

    const store = configureStore({
      navIndex: { ...navIndex, connections, [standalonePluginPage.id]: standalonePluginPage },
      plugins: getPluginsStateMock([]),
    });

    renderPage(ROUTES.AddNewConnection, store);

    // We expect not to see the text that would be rendered by the core "Add new connection" page
    expect(screen.queryByText('Data sources')).not.toBeInTheDocument();
    expect(screen.queryByText('No results matching your query were found')).not.toBeInTheDocument();
  });
});
