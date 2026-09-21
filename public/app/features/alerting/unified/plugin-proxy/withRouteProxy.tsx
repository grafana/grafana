/**
 * Opts alerting routes into the `grafana-prometheusalerting-app` proxy without adding the proxy
 * table to Grafana's initial bundle.
 */
import { use } from 'react';

import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { getLogger } from '@grafana/runtime/unstable';
import {
  type GrafanaRouteComponent,
  type GrafanaRouteComponentProps,
  type RouteDescriptor,
} from 'app/core/navigation/types';

/** Wraps a route only when the route proxy and unified alerting are enabled. */
export function proxied(route: RouteDescriptor): RouteDescriptor {
  const proxyEnabled = getFeatureFlagClient().getBooleanValue(FlagKeys.AlertingDataSourceManagedRouteProxy, false);

  if (!proxyEnabled || !config.unifiedAlertingEnabled) {
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
  try {
    const pluginAvailable = await isPluginAvailable();
    if (!pluginAvailable) {
      return route.component;
    }
  } catch (error) {
    getLogger('features.alerting').logWarning('Could not check Prometheus Alerting plugin availability', {
      error: String(error),
    });
    return route.component;
  }

  return loadProxiedRoute(route);
}

async function isPluginAvailable(): Promise<boolean> {
  const { isPrometheusAlertingPluginEnabled } = await import(
    /* webpackChunkName: "PrometheusAlertingPluginAvailability", webpackPrefetch: true */ './pluginAvailability'
  );
  return isPrometheusAlertingPluginEnabled();
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
