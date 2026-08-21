import { useLocation } from 'react-use';
import { render, screen } from 'test/test-utils';

import { type GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { setupMswServer } from '../mockApi';
import { mockDataSource } from '../mocks';
import { addPlugin, disablePlugin } from '../mocks/server/configure';
import { setupDataSources } from '../testSetup/datasources';
import { pluginMeta } from '../testSetup/plugins';
import { SupportedPlugin } from '../types/pluginBridges';

import { routeProxies } from './proxies';
import { withRouteProxy } from './withRouteProxy';

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  Navigate: jest.fn(({ to }: { to: string }) => `Redirected to ${to}`),
}));

// The proxy reads the browser location rather than react-router's, so that's what we drive here.
jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useLocation: jest.fn(),
}));

setupMswServer();

const ROUTE_PATH = '/alerting/:sourceName/:id/view';
const MIMIR_NAME = 'Mimir';
const MIMIR_UID = 'mimir-uid';
const DATA_SOURCE_URL = `/alerting/${MIMIR_NAME}/${encodeURIComponent(`cri$${MIMIR_NAME}$ns$group$rule$abc`)}/view`;
const GRAFANA_URL = '/alerting/grafana/some-rule-uid/view';
const PLUGIN_TARGET = `/a/${SupportedPlugin.PrometheusAlerting}/rules/${encodeURIComponent(
  `cri$${MIMIR_UID}$ns$group$rule$abc`
)}`;

beforeEach(() => {
  setupDataSources(mockDataSource({ name: MIMIR_NAME, uid: MIMIR_UID, type: 'prometheus' }));
});

function CorePage() {
  return <div>core alerting page</div>;
}

function renderProxiedRoute(pathname: string, search = '') {
  jest.mocked(useLocation).mockReturnValue({ pathname, search, trigger: '' });

  const proxy = routeProxies.find(({ path }) => path === ROUTE_PATH);
  if (!proxy) {
    throw new Error(`No proxy registered for ${ROUTE_PATH}`);
  }

  const ProxiedPage = withRouteProxy(proxy, CorePage);

  const props: GrafanaRouteComponentProps = {
    route: { path: ROUTE_PATH, component: CorePage },
    queryParams: {},
    location: { pathname, search, hash: '', state: null, key: 'test' },
  };

  return render(<ProxiedPage {...props} />, { historyOptions: { initialEntries: [pathname] } });
}

describe('withRouteProxy', () => {
  it('renders the Grafana page for a Grafana-managed URL', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    renderProxiedRoute(GRAFANA_URL);

    // There on the very first render — the URL isn't data source managed, so the page never waits
    // on the plugin check.
    expect(screen.getByText('core alerting page')).toBeInTheDocument();

    // Let the (unused) plugin check settle, then confirm we stayed put.
    expect(await screen.findByText('core alerting page')).toBeInTheDocument();
    expect(screen.queryByText(`Redirected to ${PLUGIN_TARGET}`)).not.toBeInTheDocument();
  });

  it('renders the Grafana page when the plugin is not installed', async () => {
    renderProxiedRoute(DATA_SOURCE_URL);

    expect(await screen.findByText('core alerting page')).toBeInTheDocument();
  });

  it('renders the Grafana page when the plugin is installed but disabled', async () => {
    // usePluginBridge reports `installed: false` for a disabled plugin, so a disabled plugin is
    // treated the same as an absent one — we keep serving the page ourselves.
    disablePlugin(SupportedPlugin.PrometheusAlerting);

    renderProxiedRoute(DATA_SOURCE_URL);

    expect(await screen.findByText('core alerting page')).toBeInTheDocument();
    expect(screen.queryByText(`Redirected to ${PLUGIN_TARGET}`)).not.toBeInTheDocument();
  });

  it('redirects a data source managed URL once the plugin is installed', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    renderProxiedRoute(DATA_SOURCE_URL);

    expect(await screen.findByText(`Redirected to ${PLUGIN_TARGET}`)).toBeInTheDocument();
    expect(screen.queryByText('core alerting page')).not.toBeInTheDocument();
  });

  it('keeps the query string when redirecting', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    renderProxiedRoute(DATA_SOURCE_URL, '?tab=instances');

    expect(await screen.findByText(`Redirected to ${PLUGIN_TARGET}?tab=instances`)).toBeInTheDocument();
  });

  it('shows a loading state while it works out where the page belongs', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    renderProxiedRoute(DATA_SOURCE_URL);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByText(`Redirected to ${PLUGIN_TARGET}`)).toBeInTheDocument();
  });
});
