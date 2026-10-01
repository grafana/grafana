import { Suspense, use } from 'react';
import { act, render, screen } from 'test/test-utils';

import { type MonitoringLogger, config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { mockLogger, setTestFlags } from '@grafana/test-utils/unstable';
import { PageLoader } from '@grafana/ui';
import {
  type GrafanaRouteComponent,
  type GrafanaRouteComponentProps,
  type RouteDescriptor,
} from 'app/core/navigation/types';

import { withRouteProxyForPath } from './ProxiedAlertingRoute';
import { isPrometheusAlertingPluginEnabled } from './pluginAvailability';
import { proxied } from './withRouteProxy';

jest.mock('./pluginAvailability', () => ({
  isPrometheusAlertingPluginEnabled: jest.fn(),
}));

// Stands in for the real proxy chunk. The real one, for a URL Grafana keeps, renders the route's
// own page — which is itself lazy and so suspends inside the proxy's boundary. That second wait is
// what the last test here is about.
jest.mock('./ProxiedAlertingRoute', () => ({
  withRouteProxyForPath: jest.fn((_path: string, RoutePage: GrafanaRouteComponent) => RoutePage),
}));

const CorePage = () => <div>core alerting page</div>;

function route(path: string): RouteDescriptor {
  return { path, component: CorePage };
}

function routeProps(path: string): GrafanaRouteComponentProps {
  return {
    route: route(path),
    queryParams: {},
    location: { pathname: path, search: '', hash: '', state: null, key: 'test' },
  };
}

describe('proxied', () => {
  const unifiedAlertingEnabled = config.unifiedAlertingEnabled;
  let logger: MonitoringLogger;

  beforeEach(() => {
    logger = mockLogger('features.alerting');
    setTestFlags({ [FlagKeys.AlertingDataSourceManagedRouteProxy]: true });
    jest.mocked(isPrometheusAlertingPluginEnabled).mockResolvedValue(true);
    jest.mocked(withRouteProxyForPath).mockClear();
  });

  afterEach(() => {
    config.unifiedAlertingEnabled = unifiedAlertingEnabled;
    setTestFlags();
  });

  it('leaves the route alone when the flag is off', () => {
    config.unifiedAlertingEnabled = true;
    setTestFlags({ [FlagKeys.AlertingDataSourceManagedRouteProxy]: false });

    // Handing the route straight back is what keeps an instance without the plugin from doing any
    // proxy work at all — no wrapper means no chunk is ever fetched for these routes.
    expect(proxied(route('/alerting/groups/')).component).toBe(CorePage);
  });

  it('wraps the route so the proxy gets a say', () => {
    config.unifiedAlertingEnabled = true;

    expect(proxied(route('/alerting/silences')).component).not.toBe(CorePage);
  });

  it('does not load the route proxy when the plugin is unavailable', async () => {
    config.unifiedAlertingEnabled = true;
    jest.mocked(isPrometheusAlertingPluginEnabled).mockResolvedValue(false);
    const PATH = '/alerting/silences';
    const ProxiedPage = proxied(route(PATH)).component;

    // React.use resolves the availability module and its probe asynchronously.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () =>
      render(
        <Suspense fallback={<PageLoader />}>
          <ProxiedPage {...routeProps(PATH)} />
        </Suspense>
      )
    );

    expect(await screen.findByText('core alerting page')).toBeInTheDocument();
    expect(isPrometheusAlertingPluginEnabled).toHaveBeenCalled();
    expect(withRouteProxyForPath).not.toHaveBeenCalled();
  });

  it('falls back to the Grafana route and logs when the plugin availability check fails', async () => {
    config.unifiedAlertingEnabled = true;
    jest.mocked(isPrometheusAlertingPluginEnabled).mockRejectedValue(new Error('plugin lookup failed'));
    const PATH = '/alerting/silences';
    const ProxiedPage = proxied(route(PATH)).component;

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () =>
      render(
        <Suspense fallback={<PageLoader />}>
          <ProxiedPage {...routeProps(PATH)} />
        </Suspense>
      )
    );

    expect(await screen.findByText('core alerting page')).toBeInTheDocument();
    expect(withRouteProxyForPath).not.toHaveBeenCalled();
    expect(logger.logWarning).toHaveBeenCalledWith('Could not check Prometheus Alerting plugin availability', {
      error: 'Error: plugin lookup failed',
    });
  });

  it('leaves the route alone when unified alerting is switched off', () => {
    config.unifiedAlertingEnabled = false;

    // The route serves the "alerting is not enabled" page, so there is nothing to hand over.
    expect(proxied(route('/alerting/silences')).component).toBe(CorePage);
  });

  it('keeps everything else about the route', () => {
    config.unifiedAlertingEnabled = true;
    const roles = () => ['Admin'];

    const result = proxied({ path: '/alerting/silences', component: CorePage, roles, pageClass: 'page-alerting' });

    expect(result.path).toBe('/alerting/silences');
    expect(result.roles).toBe(roles);
    expect(result.pageClass).toBe('page-alerting');
  });

  it('shows the ordinary page loader, not a redirect notice, while a Grafana page loads', async () => {
    config.unifiedAlertingEnabled = true;

    // Most URLs on a proxied route are Grafana's own and are not going anywhere, so this wait must
    // not claim a redirect is happening. Every other route shows PageLoader here.
    const neverLoads = new Promise<never>(() => {});
    const StillLoading: GrafanaRouteComponent = () => {
      use(neverLoads);
      return null;
    };
    const PATH = '/alerting/silence/new';
    const ProxiedPage = proxied({ path: PATH, component: StillLoading }).component;

    // React.use resolves the availability module and its probe asynchronously.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () =>
      render(
        <Suspense fallback={<PageLoader />}>
          <ProxiedPage {...routeProps(PATH)} />
        </Suspense>
      )
    );

    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Redirecting…')).not.toBeInTheDocument();
  });
});
