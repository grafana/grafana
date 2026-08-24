import { useLocation } from 'react-use';
import { act, render, screen } from 'test/test-utils';

import { setLogger } from '@grafana/runtime/unstable';
import * as appNotification from 'app/core/copy/appNotification';
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

const OTHER_DATA_SOURCE_URL = `/alerting/${MIMIR_NAME}/${encodeURIComponent(`cri$${MIMIR_NAME}$ns$group$other$def`)}/view`;
const OTHER_PLUGIN_TARGET = `/a/${SupportedPlugin.PrometheusAlerting}/rules/${encodeURIComponent(
  `cri$${MIMIR_UID}$ns$group$other$def`
)}`;

const logError = jest.fn();
const corePageRendered = jest.fn();

beforeEach(() => {
  setupDataSources(mockDataSource({ name: MIMIR_NAME, uid: MIMIR_UID, type: 'prometheus' }));

  logError.mockClear();
  corePageRendered.mockClear();
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

/** The notification goes into the redux store, which nothing renders here — so watch the call instead. */
function mockAppNotifications() {
  const info = jest.fn();
  jest.spyOn(appNotification, 'useAppNotification').mockReturnValue({
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    info,
  });
  return info;
}

function CorePage() {
  corePageRendered();
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

/**
 * One proxy component that stays mounted while the URL under it changes, which a remount would
 * hide — the state left over from the previous URL is the whole point of the tests using this.
 */
function mountedProxy(override?: (proxy: RouteProxy) => Partial<RouteProxy>) {
  const proxy = routeProxies.find(({ path }) => path === ROUTE_PATH);
  if (!proxy) {
    throw new Error(`No proxy registered for ${ROUTE_PATH}`);
  }

  const ProxiedPage = withRouteProxy({ ...proxy, ...override?.(proxy) }, CorePage);

  /** Points both the browser location and the route props at `pathname`. */
  const at = (pathname: string): GrafanaRouteComponentProps => {
    jest.mocked(useLocation).mockReturnValue({ pathname, search: '', trigger: '' });
    return {
      route: { path: ROUTE_PATH, component: CorePage },
      queryParams: {},
      location: { pathname, search: '', hash: '', state: null, key: 'test' },
    };
  };

  return { ProxiedPage, at };
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

  it('never renders the Grafana page on the way to a redirect', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    renderProxiedRoute(DATA_SOURCE_URL);

    expect(await screen.findByText(`Redirected to ${PLUGIN_TARGET}`)).toBeInTheDocument();

    // Mounting it fires off every request it makes, for a page we're about to leave. The render
    // right after the plugin check settles is the one that's easy to get wrong.
    expect(corePageRendered).not.toHaveBeenCalled();
  });

  it('tells the person why the page changed under them', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);
    const info = mockAppNotifications();

    renderProxiedRoute(DATA_SOURCE_URL);

    expect(await screen.findByText(`Redirected to ${PLUGIN_TARGET}`)).toBeInTheDocument();
    expect(info).toHaveBeenCalledWith(
      'Opened in the Prometheus Alerting plugin',
      'Data source managed alerting is handled by the Prometheus Alerting plugin.'
    );
  });

  it('says nothing when the page stays on Grafana', async () => {
    const info = mockAppNotifications();

    renderProxiedRoute(DATA_SOURCE_URL);

    expect(await screen.findByText('core alerting page')).toBeInTheDocument();
    expect(info).not.toHaveBeenCalled();
  });

  it('keeps the query string when redirecting', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    renderProxiedRoute(DATA_SOURCE_URL, '?tab=instances');

    expect(await screen.findByText(`Redirected to ${PLUGIN_TARGET}?tab=instances`)).toBeInTheDocument();
  });

  it('does not hand out the last URL’s target when the URL changes under it', async () => {
    addPlugin(pluginMeta[SupportedPlugin.PrometheusAlerting]);

    const { ProxiedPage, at } = mountedProxy();

    const { rerender } = render(<ProxiedPage {...at(DATA_SOURCE_URL)} />);
    expect(await screen.findByText(`Redirected to ${PLUGIN_TARGET}`)).toBeInTheDocument();

    rerender(<ProxiedPage {...at(OTHER_DATA_SOURCE_URL)} />);

    // Sending someone to the rule they were looking at a moment ago would be worse than waiting.
    expect(screen.queryByText(`Redirected to ${PLUGIN_TARGET}`)).not.toBeInTheDocument();
    expect(await screen.findByText(`Redirected to ${OTHER_PLUGIN_TARGET}`)).toBeInTheDocument();
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

  it('keeps waiting when the URL moves on after a timeout', async () => {
    jest
      .spyOn(pluginBridgeHooks, 'probePlugin')
      .mockResolvedValue({ settings: pluginMeta[SupportedPlugin.PrometheusAlerting] });
    jest.useFakeTimers();

    // Never settles for the first URL, works normally for anything else.
    const { ProxiedPage, at } = mountedProxy((proxy) => ({
      handler: (context) => (context.pathname === DATA_SOURCE_URL ? new Promise(() => {}) : proxy.handler(context)),
    }));

    const { rerender } = render(<ProxiedPage {...at(DATA_SOURCE_URL)} />);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });

    // Giving up and showing the Grafana page for this URL is right.
    expect(await screen.findByText('core alerting page')).toBeInTheDocument();
    corePageRendered.mockClear();

    // A different data source managed URL, same mounted component. The last URL timing out says
    // nothing about this one, so we should be working it out, not showing the page we're leaving.
    rerender(<ProxiedPage {...at(OTHER_DATA_SOURCE_URL)} />);

    expect(await screen.findByText(`Redirected to ${OTHER_PLUGIN_TARGET}`)).toBeInTheDocument();
    expect(corePageRendered).not.toHaveBeenCalled();
  });

  it('falls back to Grafana and logs when the handler takes too long to resolve a URL', async () => {
    // The plugin answers straight away, so the only thing left to wait on is the handler, which
    // is what this test is about.
    jest
      .spyOn(pluginBridgeHooks, 'probePlugin')
      .mockResolvedValue({ settings: pluginMeta[SupportedPlugin.PrometheusAlerting] });
    jest.useFakeTimers();

    // A handler that never settles — without a ceiling of its own this would load forever.
    renderProxiedRoute(DATA_SOURCE_URL, '', { handler: () => new Promise(() => {}) });

    await act(async () => {
      // The async variant, because the two waits are chained — the handler's timer is only set
      // once the plugin check has settled, which takes a microtask.
      await jest.advanceTimersByTimeAsync(5_000);
    });

    expect(await screen.findByText('core alerting page')).toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Timed out while resolving the Prometheus Alerting plugin URL' }),
      { timeout: '5000', path: ROUTE_PATH }
    );
  });

  it('falls back to Grafana and logs when plugin discovery times out', async () => {
    // A plugin check that never comes back. Without a ceiling of its own the page would sit on
    // "Redirecting…" forever.
    jest.spyOn(pluginBridgeHooks, 'probePlugin').mockReturnValue(new Promise(() => {}));
    jest.useFakeTimers();

    renderProxiedRoute(DATA_SOURCE_URL);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });

    expect(await screen.findByText('core alerting page')).toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Timed out while checking Prometheus Alerting plugin status' }),
      { timeout: '5000' }
    );
  });
});
