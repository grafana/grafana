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

import { isPluginEnabled, probePlugin } from '../hooks/usePluginBridge';
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

/**
 * Where a URL ends up, once we've worked it out.
 *
 * It's an object rather than a bare string so that `undefined` can only mean one thing: we haven't
 * worked it out yet. `url` being unset means we looked and there's nowhere in the plugin to send
 * this URL — either because there's no plugin, or because it has no page for this URL, or because
 * working it out failed. All three land on the Grafana page, so there's nothing to tell apart.
 *
 * It carries the location it was worked out for, so a result left over from a moment ago can't be
 * mistaken for an answer about the location we're looking at now.
 */
interface ResolvedTarget {
  context: ProxyContext;
  url: string | undefined;
}

/** Shown once we know a redirect is coming. Up to that point the route shows the usual loader. */
function RedirectingPage() {
  return (
    <Page navId="alerting">
      <LoadingPlaceholder text={t('alerting.proxied-alerting-route.text-redirecting', 'Redirecting…')} />
    </Page>
  );
}

/** Builds the error `withTimeout` fails with, and records it on the way past. */
function timedOut(message: string, timeoutMs: number, path?: string): Error {
  const error = new Error(message);
  getLogger('features.alerting').logError(error, { timeout: String(timeoutMs), ...(path ? { path } : {}) });
  return error;
}

/**
 * Works out where in the plugin a URL belongs: first whether the plugin is there at all, then
 * whether it has a page for this particular URL. Undefined either way means we keep serving the
 * Grafana page.
 *
 * Both steps are in one chain on purpose. Asking about the plugin in a hook of its own makes its
 * answer an input to the second step, and `useAsync` holds on to its last result when its inputs
 * change — so there would be a render where the plugin has just been found but this still says
 * "nowhere to go", and we'd mount the Grafana page and fire off all of its requests for a page
 * we're about to leave.
 */
async function resolveTarget(proxy: RouteProxy, context: ProxyContext): Promise<string | undefined> {
  const { settings } = await withTimeout(
    probePlugin(SupportedPlugin.PrometheusAlerting),
    PLUGIN_DISCOVERY_TIMEOUT_MS,
    () => timedOut('Timed out while checking Prometheus Alerting plugin status', PLUGIN_DISCOVERY_TIMEOUT_MS)
  );

  // A plugin that's installed but switched off is treated the same as one that was never there.
  if (!isPluginEnabled(settings)) {
    return undefined;
  }

  return withTimeout(proxy.handler(context), TARGET_RESOLUTION_TIMEOUT_MS, () =>
    timedOut('Timed out while resolving the Prometheus Alerting plugin URL', TARGET_RESOLUTION_TIMEOUT_MS, proxy.path)
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

    const { value: resolved } = useAsync(async (): Promise<ResolvedTarget> => {
      if (!belongsToPlugin) {
        return { context, url: undefined };
      }

      // Swallowed rather than left to reject, because useAsync keeps hold of a rejection until the
      // next run settles — so a timeout on one URL would still be sitting there when the next one
      // is being worked out, and we'd read it as an answer about that one. A failure and "nowhere
      // to go" mean the same thing here anyway: serve the Grafana page. Timeouts log themselves on
      // the way through.
      return { context, url: await resolveTarget(proxy, context).catch(() => undefined) };
    }, [belongsToPlugin, context]);

    // The URL can change while the page is mounted, and `useAsync` keeps the answer it worked out
    // for the old one — reported as settled, because it only flips itself back to loading from an
    // effect, which runs after this render. So ask which location the answer is about rather than
    // whether there is one. Sending someone to the rule they were looking at a moment ago would be
    // worse than making them wait.
    const workingOutTarget = resolved?.context !== context;

    // The matcher already said yes before this module was fetched, but again — the URL can change.
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
    if (workingOutTarget) {
      return <RedirectingPage />;
    }

    // Either the plugin isn't available, or we couldn't work out where in it this URL belongs.
    if (!resolved?.url) {
      return <RoutePage {...props} />;
    }

    return <Navigate replace to={resolved.url} />;
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
