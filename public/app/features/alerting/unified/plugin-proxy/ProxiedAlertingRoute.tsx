/**
 * The part of the route proxy that only a data source managed URL needs: check the plugin is
 * there, work out where in it the URL belongs, and send the browser on.
 *
 * Loaded on demand from `withRouteProxy.tsx`, so this module is free to import whatever it needs.
 */
import { useMemo } from 'react';
import { Navigate } from 'react-router-dom-v5-compat';
import { useAsync, useLocation } from 'react-use';

import { t } from '@grafana/i18n';
import { getLogger } from '@grafana/runtime/unstable';
import { LoadingPlaceholder } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { type GrafanaRouteComponent, type GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { usePluginBridge } from '../hooks/usePluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';
import { withTimeout } from '../utils/promise';

import { findRouteProxy } from './proxies';
import { buildProxyContext, stripSubPath } from './resolve';
import { type ProxyContext, type RouteProxy } from './types';

const PLUGIN_DISCOVERY_TIMEOUT_MS = 5_000;
/**
 * Handlers look up data sources to swap names for UIDs, which can reach the backend. Without a
 * ceiling of its own, a request that never comes back would leave the page loading forever.
 */
const TARGET_RESOLUTION_TIMEOUT_MS = 5_000;

/** Shown once we know a redirect is coming. Up to that point the route shows the usual loader. */
function RedirectingPage() {
  return (
    <Page navId="alerting">
      <LoadingPlaceholder text={t('alerting.proxied-alerting-route.text-redirecting', 'Redirecting…')} />
    </Page>
  );
}

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
export function withRouteProxy(proxy: RouteProxy, RoutePage: GrafanaRouteComponent): GrafanaRouteComponent {
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
          getLogger('features.alerting').logError(
            new Error('Timed out while checking Prometheus Alerting plugin status'),
            {
              timeout: String(error.timeoutMs),
            }
          );
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
        getLogger('features.alerting').logError(error, {
          timeout: String(TARGET_RESOLUTION_TIMEOUT_MS),
          path: proxy.path,
        });
        return error;
      });
    }, [belongsToPlugin, pluginAvailable, context]);

    // The matcher already said yes before this module was fetched, but the URL can change while
    // the page is mounted.
    if (!belongsToPlugin) {
      return <RoutePage {...props} />;
    }

    // Now that we know this URL is the plugin's, say so — the wait before this point showed the
    // ordinary page loader, because up to here a redirect was only a possibility. The page we
    // might redirect away from is deliberately not rendered here: mounting it would fire off all
    // of its requests for nothing.
    //
    // We say we're redirecting before we're certain of it: by this point the URL is data source
    // managed, so a redirect is what happens unless the plugin turns out to be missing or we can't
    // work out where in it this URL lives. Both of those land on the Grafana page below, which is
    // the page people expected in the first place, so there's nothing to walk back.
    if (checkingPlugin || buildingTarget) {
      return <RedirectingPage />;
    }

    // Either the plugin isn't available, or we couldn't work out where in it this URL belongs.
    if (!target) {
      return <RoutePage {...props} />;
    }

    return <Navigate replace to={target} />;
  };
}

/**
 * Same as `withRouteProxy`, for callers that only have the route path. The proxy objects live in
 * this chunk, so the eager side can't look one up itself.
 *
 * Returns the page unwrapped if the table has no entry for the path, which means a route opted in
 * without one — `routes.test.tsx` guards against that.
 */
export function withRouteProxyForPath(routePath: string, RoutePage: GrafanaRouteComponent): GrafanaRouteComponent {
  const proxy = findRouteProxy(routePath);
  return proxy ? withRouteProxy(proxy, RoutePage) : RoutePage;
}
