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

import { logError } from '../Analytics';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { usePluginBridge } from '../hooks/usePluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';
import { withTimeout } from '../utils/promise';

import { routeProxies } from './proxies';
import { buildProxyContext, stripSubPath } from './resolve';
import { type ProxyContext, type RouteProxy } from './types';

const PLUGIN_DISCOVERY_TIMEOUT_MS = 5_000;
/**
 * Handlers look up data sources to swap names for UIDs, which can reach the backend. Without a
 * ceiling of its own, a request that never comes back would leave the page loading forever.
 */
const TARGET_RESOLUTION_TIMEOUT_MS = 5_000;

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
    const { loading: checkingPlugin, installed: pluginAvailable } = usePluginBridge(
      SupportedPlugin.PrometheusAlerting,
      {
        timeoutMs: belongsToPlugin ? PLUGIN_DISCOVERY_TIMEOUT_MS : undefined,
        onTimeout: (error) => {
          logError(new Error('Timed out while checking Prometheus Alerting plugin status'), {
            timeout: String(error.timeoutMs),
          });
        },
      }
    );

    // Only worth working out a target once we know there's a plugin to send people to.
    const { value: target, loading: buildingTarget } = useAsync(async () => {
      if (!belongsToPlugin || !pluginAvailable) {
        return undefined;
      }

      return withTimeout(proxy.handler(context), TARGET_RESOLUTION_TIMEOUT_MS, () => {
        const error = new Error('Timed out while resolving the Prometheus Alerting plugin URL');
        logError(error, { timeout: String(TARGET_RESOLUTION_TIMEOUT_MS), path: proxy.path });
        return error;
      });
    }, [belongsToPlugin, pluginAvailable, context]);

    // Not a data source managed URL, so don't make this page wait on a check it doesn't need.
    if (!belongsToPlugin) {
      return <Page {...props} />;
    }

    // Shown with the usual page furniture around it, so a slow check looks like a page that hasn't
    // finished loading rather than a spinner on an empty screen. The page we might redirect away
    // from is deliberately not rendered here — mounting it would fire off all of its requests for
    // nothing.
    //
    // We say we're redirecting before we're certain of it: by this point the URL is data source
    // managed, so a redirect is what happens unless the plugin turns out to be missing or we can't
    // work out where in it this URL lives. Both of those land on the Grafana page below, which is
    // the page people expected in the first place, so there's nothing to walk back.
    if (checkingPlugin || buildingTarget) {
      return (
        <AlertingPageWrapper navId="alerting">
          <LoadingPlaceholder text={t('alerting.proxied-alerting-route.text-redirecting', 'Redirecting…')} />
        </AlertingPageWrapper>
      );
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
