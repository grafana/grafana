/**
 * Hands data source managed alerting URLs over to the `grafana-prometheusalerting-app` plugin.
 *
 * The alerting route table imports this module while the app is starting up, so everything it
 * reaches ends up in the first bundle the browser downloads — which is why it holds no opinion
 * about which URLs the plugin serves. Routes name themselves by calling `proxied()`, and the table
 * saying what to do with them lives in `proxies.ts`, fetched the first time someone opens one.
 */
import { Suspense, lazy } from 'react';

import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { getLogger } from '@grafana/runtime/unstable';
import { PageLoader } from '@grafana/ui';
import {
  type GrafanaRouteComponent,
  type GrafanaRouteComponentProps,
  type RouteDescriptor,
} from 'app/core/navigation/types';

function proxiedComponent(route: RouteDescriptor): GrafanaRouteComponent {
  const RoutePage = route.component;

  const LazyProxiedRoute = lazy(() =>
    import(/* webpackChunkName: "AlertingRouteProxy" */ './ProxiedAlertingRoute')
      .then(({ withRouteProxyForPath }) => ({ default: withRouteProxyForPath(route.path, RoutePage) }))
      .catch((error) => {
        // Most likely a stale bundle after a deploy. Serving Grafana's own page is the same
        // fallback we use when the plugin isn't installed, and it's the page the person asked for,
        // so there's no reason to make them sit through a reload for it.
        getLogger('features.alerting').logWarning('Could not load the alerting route proxy', {
          path: route.path,
          error: String(error),
        });
        return { default: RoutePage };
      })
  );

  // Whether this particular URL needs the plugin is decided inside `ProxiedAlertingRoute`, once
  // the table has loaded. Grafana-managed URLs therefore wait on that fetch too — the trade we
  // accepted to keep the proxy out of the boot bundle entirely. The chunk is small and shared by
  // every proxied route, so it costs one request per session.
  //
  // The fallback is the same loader every other route shows, on purpose. This boundary covers two
  // waits: fetching the table, and then the page's own chunk if the URL turns out to be one
  // Grafana keeps. Most URLs on these routes are Grafana's own, so a "Redirecting…" notice here
  // would tell the majority of people something that isn't happening to them. Once we know a
  // redirect is coming, `ProxiedAlertingRoute` says so itself.
  function MaybeProxiedAlertingRoute(props: GrafanaRouteComponentProps) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LazyProxiedRoute {...props} />
      </Suspense>
    );
  }

  return MaybeProxiedAlertingRoute;
}

/**
 * Marks an alerting route as one the `grafana-prometheusalerting-app` plugin might serve, so that
 * data source managed URLs on it get handed over. Wrap the route descriptor where it is declared:
 *
 *     proxied({ path: '/alerting/silences', roles: …, component: … })
 *
 * Whether a given URL on that route actually belongs to the plugin is decided later, from the
 * table in `proxies.ts`. Grafana-managed URLs end up back on the page below, so opting a route in
 * is safe even when most of its traffic is Grafana's own.
 *
 * Does nothing unless the `alerting.dataSourceManagedRouteProxy` flag is on. Handing the route
 * straight back means an instance without the plugin does no proxy work at all — no wrapper, no
 * chunk to fetch, no plugin lookup — which is why the flag is read here rather than inside the
 * proxy. It has to be a flag: nothing else can say whether the plugin is there at the moment the
 * route table is assembled, because the plugin metadata is only available asynchronously.
 *
 * Also does nothing when unified alerting is switched off — every alerting route serves the
 * "alerting is not enabled" page then, and someone who turned alerting off didn't ask us to find
 * them another way in.
 *
 * Both are read per call rather than once at import, because neither is populated until after this
 * module is evaluated.
 */
export function proxied(route: RouteDescriptor): RouteDescriptor {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.AlertingDataSourceManagedRouteProxy, false)) {
    return route;
  }

  if (!config.unifiedAlertingEnabled) {
    return route;
  }

  return { ...route, component: proxiedComponent(route) };
}
