/**
 * Hands data source managed alerting URLs over to the `grafana-prometheusalerting-app` plugin.
 *
 * The alerting route table imports this module while the app is starting up, so everything it
 * reaches ends up in the first bundle the browser downloads. Keep the imports here to things that
 * are already in that bundle; the actual redirecting lives in `ProxiedAlertingRoute.tsx`, which is
 * fetched only once a URL turns out to be one the plugin should serve.
 */
import { Suspense, lazy, useMemo } from 'react';
import { useLocation } from 'react-use';

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

import { findRouteMatcher } from './matchers';
import { buildProxyContext, stripSubPath } from './resolve';
import { type ProxyContext, type ProxyMatcher } from './types';

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
 * Reads the browser's location instead of react-router's, because react-router hands back a
 * pathname that is neither properly encoded nor decoded, which mangles rule names and namespaces.
 * There's a longer explanation of that in `utils/rule-id.ts`.
 */
export function useProxyContext(routePath: string): ProxyContext {
  const { pathname = '', search = '' } = useLocation();

  return useMemo(() => buildProxyContext(routePath, stripSubPath(pathname), search), [routePath, pathname, search]);
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

function proxiedComponent(route: RouteDescriptor, matches: ProxyMatcher): GrafanaRouteComponent {
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

  function MaybeProxiedAlertingRoute(props: GrafanaRouteComponentProps) {
    const context = useProxyContext(route.path);

    // Not a data source managed URL, which is the common case — render the page straight away and
    // don't fetch the proxy at all.
    if (!matches(context)) {
      return <RoutePage {...props} />;
    }

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
    const matches = findRouteMatcher(route.path);
    if (!matches) {
      return route;
    }

    return { ...route, component: proxiedComponent(route, matches) };
  });
}
