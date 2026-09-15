/**
 * Hands data source managed alerting URLs over to the `grafana-prometheusalerting-app` plugin.
 *
 * The alerting route table imports this module while the app is starting up, so everything it
 * reaches ends up in the first bundle the browser downloads. The only thing it needs from the
 * proxy up front is the list of paths to wrap; deciding whether a given URL belongs to the plugin,
 * and where in it, lives in `proxies.ts` and is fetched the first time someone opens one of those
 * pages.
 */
import { Suspense, lazy } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { getLogger } from '@grafana/runtime/unstable';
import { LoadingPlaceholder } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import {
  type GrafanaRouteComponent,
  type GrafanaRouteComponentProps,
  type RouteDescriptor,
} from 'app/core/navigation/types';

import { isProxiedRoutePath } from './proxiedPaths';

/**
 * What a proxied page shows while we work out where it belongs. Shared with
 * `ProxiedAlertingRoute.tsx` so that fetching that module and then checking on the plugin look
 * like one continuous wait rather than two different ones.
 */
export function RedirectingPage() {
  return (
    <Page navId="alerting">
      <LoadingPlaceholder text={t('alerting.proxied-alerting-route.text-redirecting', 'Redirecting…')} />
    </Page>
  );
}

/**
 * One wrapper per route, kept for the life of the page.
 *
 * This is not an optimisation. `getAppRoutes()` runs in `AppWrapper`'s render body, so
 * `applyRouteProxies` runs again on every render. A fresh `lazy()` has no resolved promise on it,
 * so React would unmount the page, suspend again, and re-run the redirect work — every render,
 * forever.
 */
const proxiedComponents = new Map<string, GrafanaRouteComponent>();

function proxiedComponent(route: RouteDescriptor): GrafanaRouteComponent {
  const cached = proxiedComponents.get(route.path);
  if (cached) {
    return cached;
  }

  // Closes over the component this route had the first time we saw it. Fine as things stand — none
  // of the proxied routes picks its component based on a feature toggle — but worth knowing if one
  // ever starts to.
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
  function MaybeProxiedAlertingRoute(props: GrafanaRouteComponentProps) {
    return (
      <Suspense fallback={<RedirectingPage />}>
        <LazyProxiedRoute {...props} />
      </Suspense>
    );
  }

  proxiedComponents.set(route.path, MaybeProxiedAlertingRoute);
  return MaybeProxiedAlertingRoute;
}

/**
 * Wraps every route that has a matching entry in the proxy table. Paths are matched exactly, so a
 * renamed route silently loses its proxy — `routes.test.tsx` guards against that.
 *
 * Does nothing when unified alerting is switched off. Every alerting route serves the "alerting is
 * not enabled" page in that case, and someone who turned alerting off didn't ask us to find them
 * another way in. Read per call rather than once at import, because `config` is filled in after
 * this module is evaluated.
 */
export function applyRouteProxies(routes: RouteDescriptor[]): RouteDescriptor[] {
  if (!config.unifiedAlertingEnabled) {
    return routes;
  }

  return routes.map((route) => {
    if (!isProxiedRoutePath(route.path)) {
      return route;
    }

    return { ...route, component: proxiedComponent(route) };
  });
}
