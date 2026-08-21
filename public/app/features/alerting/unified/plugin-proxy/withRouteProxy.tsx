import { useMemo } from 'react';
import { Navigate } from 'react-router-dom-v5-compat';
import { useAsync, useLocation } from 'react-use';

import { t } from '@grafana/i18n';
import { LoadingPlaceholder } from '@grafana/ui';
import {
  type GrafanaRouteComponent,
  type GrafanaRouteComponentProps,
  type RouteDescriptor,
} from 'app/core/navigation/types';

import { usePluginBridge } from '../hooks/usePluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';

import { routeProxies } from './proxies';
import { buildProxyContext, stripSubPath } from './resolve';
import { type ProxyContext, type RouteProxy } from './types';

/**
 * Reads the browser's location instead of react-router's, because react-router hands back a
 * pathname that is neither properly encoded nor decoded, which mangles rule names and namespaces.
 * There's a longer explanation of that in `utils/rule-id.ts`.
 */
function useProxyContext(routePath: string): ProxyContext {
  const { pathname = '', search = '' } = useLocation();

  return useMemo(() => buildProxyContext(routePath, stripSubPath(pathname), search), [routePath, pathname, search]);
}

/**
 * Wraps an alerting page so that data source managed URLs are handed over to the
 * `grafana-prometheusalerting-app` plugin. If the URL isn't data source managed, or the plugin isn't
 * installed and enabled, the page renders exactly as it does today.
 *
 * Access control is left to the plugin — we only decide where the URL should be served from.
 */
export function withRouteProxy(proxy: RouteProxy, Page: GrafanaRouteComponent): GrafanaRouteComponent {
  return function ProxiedAlertingRoute(props: GrafanaRouteComponentProps) {
    const context = useProxyContext(proxy.path);
    const belongsToPlugin = proxy.matches(context);

    // `installed` is true only when the plugin is both present and enabled, so a plugin that's
    // been switched off is treated the same as one that was never there.
    const { loading: checkingPlugin, installed: pluginAvailable } = usePluginBridge(SupportedPlugin.PrometheusAlerting);
    // Only worth working out a target once we know there's a plugin to send people to.
    const { value: target, loading: buildingTarget } = useAsync(
      async () => (belongsToPlugin && pluginAvailable ? proxy.handler(context) : undefined),
      [belongsToPlugin, pluginAvailable, context]
    );

    // Not a data source managed URL, so don't make this page wait on a check it doesn't need.
    if (!belongsToPlugin) {
      return <Page {...props} />;
    }

    if (checkingPlugin || buildingTarget) {
      return <LoadingPlaceholder text={t('alerting.proxied-alerting-route.text-loading', 'Loading…')} />;
    }

    // Either the plugin isn't available, or we couldn't work out where in it this URL belongs.
    if (!target) {
      return <Page {...props} />;
    }

    return <Navigate replace to={target} />;
  };
}

/**
 * Wraps every route that has a matching entry in the proxy table. Paths are matched exactly, so a
 * renamed route silently loses its proxy — `routes.test.tsx` guards against that.
 */
export function applyRouteProxies(routes: RouteDescriptor[]): RouteDescriptor[] {
  return routes.map((route) => {
    const proxy = routeProxies.find(({ path }) => path === route.path);
    if (!proxy) {
      return route;
    }

    return { ...route, component: withRouteProxy(proxy, route.component) };
  });
}
