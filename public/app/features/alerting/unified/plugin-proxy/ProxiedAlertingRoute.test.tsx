import { useLocation } from 'react-use';
import { act, render, screen } from 'test/test-utils';

import { setLogger } from '@grafana/runtime/unstable';
import { type GrafanaRouteComponentProps } from 'app/core/navigation/types';

import * as pluginBridgeHooks from '../hooks/usePluginBridge';
import { setupMswServer } from '../mockApi';
import { mockDataSource } from '../mocks';
import { addPlugin, disablePlugin } from '../mocks/server/configure';
import { setupDataSources } from '../testSetup/datasources';
import { pluginMeta } from '../testSetup/plugins';
import { SupportedPlugin } from '../types/pluginBridges';

import { withRouteProxy } from './ProxiedAlertingRoute';
import { routeProxies } from './proxies';
import { type RouteProxy } from './types';

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

const logError = jest.fn();

beforeEach(() => {
  setupDataSources(mockDataSource({ name: MIMIR_NAME, uid: MIMIR_UID, type: 'prometheus' }));

  logError.mockClear();
  setLogger('features.alerting', {
    logDebug: jest.fn(),
    logError,
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning: jest.fn(),
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function CorePage() {
  return <div>core alerting page</div>;
}

function renderProxiedRoute(pathname: string, search = '', override?: Partial<RouteProxy>) {
  jest.mocked(useLocation).mockReturnValue({ pathname, search, trigger: '' });

  const proxy = routeProxies.find(({ path }) => path === ROUTE_PATH);
  if (!proxy) {
    throw new Error(`No proxy registered for ${ROUTE_PATH}`);
  }

  const ProxiedPage = withRouteProxy({ ...proxy, ...override }, CorePage);

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

  it('says it is redirecting while it works out where the page belongs', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    renderProxiedRoute(DATA_SOURCE_URL);

    expect(screen.getByText('Redirecting…')).toBeInTheDocument();
    // The page we may redirect away from must not mount while we're still deciding, otherwise it
    // fires off all of its requests for nothing.
    expect(screen.queryByText('core alerting page')).not.toBeInTheDocument();

    expect(await screen.findByText(`Redirected to ${PLUGIN_TARGET}`)).toBeInTheDocument();
  });

  it('falls back to Grafana and logs when the handler takes too long to resolve a URL', async () => {
    // The plugin is reported as available up front so the only thing left to wait on is the
    // handler, which is what this test is about.
    jest.spyOn(pluginBridgeHooks, 'usePluginBridge').mockReturnValue({ loading: false, installed: true });
    jest.useFakeTimers();

    // A handler that never settles — without a ceiling of its own this would load forever.
    renderProxiedRoute(DATA_SOURCE_URL, '', { handler: () => new Promise(() => {}) });

    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });

    expect(await screen.findByText('core alerting page')).toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Timed out while resolving the Prometheus Alerting plugin URL' }),
      { timeout: '5000', path: ROUTE_PATH }
    );
  });

  it('falls back to Grafana and logs when plugin discovery times out', async () => {
    const timeoutError = new pluginBridgeHooks.PluginBridgeTimeoutError(SupportedPlugin.PrometheusAlerting, 5_000);
    const usePluginBridge = jest.spyOn(pluginBridgeHooks, 'usePluginBridge').mockReturnValue({
      loading: false,
      error: timeoutError,
    });

    renderProxiedRoute(DATA_SOURCE_URL);

    expect(await screen.findByText('core alerting page')).toBeInTheDocument();

    const options = usePluginBridge.mock.calls[0][1];
    options?.onTimeout?.(timeoutError);
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Timed out while checking Prometheus Alerting plugin status' }),
      { timeout: '5000' }
    );
  });
});
