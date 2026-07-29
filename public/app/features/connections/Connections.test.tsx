import { type RenderResult, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, userEvent } from 'test/test-utils';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
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
    config.pluginAdminExternalManageEnabled = true;
    (api.getDataSources as jest.Mock) = jest.fn().mockResolvedValue(mockDatasources);
    (contextSrv.hasPermission as jest.Mock) = jest.fn().mockReturnValue(true);
  });

  test('shows cloud subtitle and cards from nav tree when edition is Cloud', async () => {
    config.pluginAdminExternalManageEnabled = true;
    renderPage();

    // Cards are derived from the nav tree (navIndex mock)
    expect(await screen.findByText('Add new connection')).toBeVisible();
    expect(await screen.findByText('Collector')).toBeVisible();
    expect(await screen.findByText('Data sources')).toBeVisible();
    expect(await screen.findByText('Integrations')).toBeVisible();
    expect(await screen.findByText('Private data source connect')).toBeVisible();

    // Metadata enrichment: descriptions come from CardMetadata
    expect(
      await screen.findByText('Connect data to Grafana through data sources, integrations and apps')
    ).toBeVisible();

    // Cloud subtitle
    expect(await screen.findByText('Welcome to Connections')).toBeVisible();
    expect(
      await screen.findByText(
        'Connect your infrastructure to Grafana Cloud using data sources, integrations and apps. Use this page to add to manage everything from data ingestion to private connections and telemetry pipelines.'
      )
    ).toBeVisible();
  });

  test('shows OSS subtitle and OSS card descriptions when edition is OpenSource', async () => {
    config.pluginAdminExternalManageEnabled = false;
    renderPage();

    expect(await screen.findByText('Welcome to Connections')).toBeVisible();
    expect(
      await screen.findByText(
        'Manage your data source connections in one place. Use this page to add a new data source or manage your existing connections.'
      )
    ).toBeVisible();

    // OSS-specific card subtitle for "Add new connection"
    expect(await screen.findByText('Connect to a new data source')).toBeVisible();
    // OSS-specific title for "Data sources"
    expect(await screen.findByText('View configured data sources')).toBeVisible();
  });

  test('only shows cards for nav items present in the connections nav section', async () => {
    // Store with a minimal connections nav (e.g. OSS - only core items)
    const minimalStore = configureStore({
      navIndex: {
        ...navIndex,
        connections: {
          ...navIndex.connections,
          children: [
            {
              id: 'connections-add-new-connection',
              text: 'Add new connection',
              url: '/connections/add-new-connection',
            },
            { id: 'connections-datasources', text: 'Data sources', url: '/connections/datasources' },
          ],
        },
      },
      plugins: getPluginsStateMock([]),
    });
    renderPage(ROUTES.Base, minimalStore);

    expect(await screen.findByText('Add new connection')).toBeVisible();
    expect(await screen.findByText('Data sources')).toBeVisible();
    expect(screen.queryByText('Collector')).not.toBeInTheDocument();
    expect(screen.queryByText('Integrations')).not.toBeInTheDocument();
    expect(screen.queryByText('Private data source connect')).not.toBeInTheDocument();
  });

  describe('when Grafana is served under a subpath', () => {
    // The backend prefixes every nav url with appSubUrl
    // (navtree.go: baseUrl := s.cfg.AppSubURL + "/connections"), so the landing page
    // cards receive subpath-prefixed urls.
    const SUB_PATH = '/grafana';

    const initLocationUtil = (appSubUrl: string) =>
      locationUtil.initialize({
        config: { appSubUrl } as GrafanaConfig,
        getVariablesUrlParams: jest.fn(),
        getTimeRangeForUrl: jest.fn(),
      });

    const subPathStore = () =>
      configureStore({
        navIndex: {
          ...navIndex,
          connections: {
            ...navIndex.connections,
            children: [
              {
                id: 'connections-add-new-connection',
                text: 'Add new connection',
                url: `${SUB_PATH}/connections/add-new-connection`,
              },
              { id: 'connections-datasources', text: 'Data sources', url: `${SUB_PATH}/connections/datasources` },
            ],
          },
        },
        plugins: getPluginsStateMock([]),
      });

    beforeEach(() => initLocationUtil(SUB_PATH));
    afterEach(() => initLocationUtil(''));

    test('navigates to a path relative to the router basename', async () => {
      const user = userEvent.setup();
      renderPage(ROUTES.Base, subPathStore());

      await user.click(await screen.findByRole('button', { name: /^Data sources/i }));

      // The router basename is the subpath, so pushing a prefixed path would repeat it.
      expect(locationService.getLocation().pathname).toBe('/connections/datasources');
    });

    test('still resolves card metadata for subpath-prefixed nav urls', async () => {
      config.pluginAdminExternalManageEnabled = false;
      renderPage(ROUTES.Base, subPathStore());

      // CardMetadata is keyed on the unprefixed path, so an unnormalized url
      // silently falls back to the raw nav text and subtitle.
      expect(await screen.findByText('View configured data sources')).toBeVisible();
      expect(await screen.findByText('Connect to a new data source')).toBeVisible();
    });
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
