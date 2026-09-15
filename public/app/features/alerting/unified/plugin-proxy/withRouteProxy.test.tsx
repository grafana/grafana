import { config } from '@grafana/runtime';
import { type RouteDescriptor } from 'app/core/navigation/types';

import { applyRouteProxies } from './withRouteProxy';

const CorePage = () => null;

// One of the paths in proxiedPaths.ts, and one that isn't. Picked by hand rather than read off
// that list, so that renaming a route shows up here as well as in routes.test.tsx.
const PROXIED_PATH = '/alerting/silences';
const UNPROXIED_PATH = '/alerting/list';

function route(path: string): RouteDescriptor {
  return { path, component: CorePage };
}

describe('applyRouteProxies', () => {
  const unifiedAlertingEnabled = config.unifiedAlertingEnabled;

  afterEach(() => {
    config.unifiedAlertingEnabled = unifiedAlertingEnabled;
  });

  it('leaves every route alone when unified alerting is switched off', () => {
    config.unifiedAlertingEnabled = false;

    // Those routes all serve the "alerting is not enabled" page, so there is nothing to hand over.
    const [proxied, unproxied] = applyRouteProxies([route(PROXIED_PATH), route(UNPROXIED_PATH)]);

    expect(proxied.component).toBe(CorePage);
    expect(unproxied.component).toBe(CorePage);
  });

  it('wraps a route the plugin might serve', () => {
    config.unifiedAlertingEnabled = true;

    const [proxied] = applyRouteProxies([route(PROXIED_PATH)]);

    expect(proxied.component).not.toBe(CorePage);
  });

  it('leaves a route with no proxy alone', () => {
    config.unifiedAlertingEnabled = true;

    const [unproxied] = applyRouteProxies([route(UNPROXIED_PATH)]);

    expect(unproxied.component).toBe(CorePage);
  });

  it('reuses the same wrapper across calls', () => {
    config.unifiedAlertingEnabled = true;

    // getAppRoutes() runs in AppWrapper's render body, so this runs on every render. Handing back
    // a new component each time would remount the page and re-run the redirect work.
    const first = applyRouteProxies([route(PROXIED_PATH)])[0].component;
    const second = applyRouteProxies([route(PROXIED_PATH)])[0].component;

    expect(first).toBe(second);
  });
});
