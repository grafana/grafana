import { config } from '@grafana/runtime';
import { type RouteDescriptor } from 'app/core/navigation/types';

import { proxied } from './withRouteProxy';

const CorePage = () => null;

function route(path: string): RouteDescriptor {
  return { path, component: CorePage };
}

describe('proxied', () => {
  const unifiedAlertingEnabled = config.unifiedAlertingEnabled;

  afterEach(() => {
    config.unifiedAlertingEnabled = unifiedAlertingEnabled;
  });

  it('wraps the route so the proxy gets a say', () => {
    config.unifiedAlertingEnabled = true;

    expect(proxied(route('/alerting/silences')).component).not.toBe(CorePage);
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

  it('reuses the same wrapper across calls', () => {
    config.unifiedAlertingEnabled = true;

    // getAlertingRoutes() runs in AppWrapper's render body, so this runs on every render. Handing
    // back a new component each time would remount the page and re-run the redirect work.
    const first = proxied(route('/alerting/silences')).component;
    const second = proxied(route('/alerting/silences')).component;

    expect(first).toBe(second);
  });
});
