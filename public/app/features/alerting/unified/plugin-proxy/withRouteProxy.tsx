/**
 * Opts alerting routes into the `grafana-prometheusalerting-app` proxy without adding the proxy
 * table to Grafana's initial bundle.
 *
 * Also answers, for the rest of alerting, whether data source managed pages are being handed to the
 * plugin — so the pages that stop offering those things and the redirects agree with each other.
 */
import { use } from 'react';
import { useAsync } from 'react-use';

import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { getLogger } from '@grafana/runtime/unstable';
import {
  type GrafanaRouteComponent,
  type GrafanaRouteComponentProps,
  type RouteDescriptor,
} from 'app/core/navigation/types';

function isRouteProxyEnabled(): boolean {
  const proxyEnabled = getFeatureFlagClient().getBooleanValue(FlagKeys.AlertingDataSourceManagedRouteProxy, false);
  return proxyEnabled && config.unifiedAlertingEnabled;
}

/** Wraps a route only when the route proxy and unified alerting are enabled. */
export function proxied(route: RouteDescriptor): RouteDescriptor {
  if (!isRouteProxyEnabled()) {
    return route;
  }

  return { ...route, component: createProxiedComponent(route) };
}

function createProxiedComponent(route: RouteDescriptor): GrafanaRouteComponent {
  let routeComponentPromise: Promise<GrafanaRouteComponent> | undefined;

  function getRouteComponent(): Promise<GrafanaRouteComponent> {
    routeComponentPromise ??= resolveRouteComponent(route);
    return routeComponentPromise;
  }

  // GrafanaRoute provides the Suspense boundary. The route-local promise must remain stable across
  // React's retries or discovery would restart after every suspension.
  function ProxiedAlertingRoute(props: GrafanaRouteComponentProps) {
    const RouteComponent = use(getRouteComponent());
    return <RouteComponent {...props} />;
  }

  return ProxiedAlertingRoute;
}

async function resolveRouteComponent(route: RouteDescriptor): Promise<GrafanaRouteComponent> {
  return (await isPluginAvailable()) ? loadProxiedRoute(route) : route.component;
}

/** A check that fails, or whose chunk won't load, counts as "not available". */
async function isPluginAvailable(): Promise<boolean> {
  try {
    const { isPrometheusAlertingPluginEnabled } = await import(
      /* webpackChunkName: "PrometheusAlertingPluginAvailability", webpackPrefetch: true */ './pluginAvailability'
    );
    return await isPrometheusAlertingPluginEnabled();
  } catch (error) {
    getLogger('features.alerting').logWarning('Could not check Prometheus Alerting plugin availability', {
      error: String(error),
    });
    return false;
  }
}

/**
 * Is the route proxy sending data source managed pages to the plugin? That's the case when the
 * proxy is switched on and the plugin is installed and enabled — the exact check `proxied()` makes.
 *
 * With the proxy switched off this answers straight away, without fetching the availability chunk.
 */
async function isRouteProxyActive(): Promise<boolean> {
  return isRouteProxyEnabled() && isPluginAvailable();
}

/** `isRouteProxyActive` for components. Reads as false until the check comes back. */
export function useRouteProxyActive(): boolean {
  const { value } = useAsync(isRouteProxyActive, []);
  return value ?? false;
}

async function loadProxiedRoute(route: RouteDescriptor): Promise<GrafanaRouteComponent> {
  try {
    const { withRouteProxyForPath } = await import(
      /* webpackChunkName: "AlertingRouteProxy" */ './ProxiedAlertingRoute'
    );
    return withRouteProxyForPath(route.path, route.component);
  } catch (error) {
    // A stale deployment chunk should fall back to the page the user requested.
    getLogger('features.alerting').logWarning('Could not load the alerting route proxy', {
      path: route.path,
      error: String(error),
    });
    return route.component;
  }
}
