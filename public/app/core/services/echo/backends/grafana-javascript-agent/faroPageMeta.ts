import { type Faro } from '@grafana/faro-core';
import { locationService } from '@grafana/runtime';

/**
 * Enriches the `meta` of every Faro signal (web-vitals, dashboard_render, errors, traces, ...)
 * with navigation context the SPA referrer chain would otherwise hide:
 *
 * - `referrer`: the external entry point that brought the user to Grafana (`document.referrer`),
 *   captured once per page load. Lets the metrics pipeline attribute traffic to its source
 *   (e.g. an issue tracker, an email link, a direct bookmark).
 * - `previousUrl`: the internal (virtual) route the user navigated from. Because Grafana is an SPA,
 *   the browser referrer does not change on internal navigation, so we track it ourselves. Absent
 *   on the landing page - the receiver reads "no previousUrl" as a session entry point.
 *
 * Both are attached to `page.attributes` so they ride on every emitted signal. Meta attributes are
 * string-only, so the landing page omits `previousUrl` rather than encoding a literal null.
 */
export function setupFaroPageMeta(faro: Faro): void {
  // Captured once: the external source for this load stays constant across internal navigation.
  const referrer = document.referrer;

  // Undefined until the first navigation to a different page; that first page is the session's landing page.
  let previousUrl: string | undefined;

  // Pathname of the page currently being viewed. Query-param-only changes (time range, variables,
  // orgId) keep this the same, so they must not be treated as leaving the page.
  let currentPath = locationService.getLocation().pathname;

  const updatePageMeta = () => {
    const attributes: Record<string, string> = { referrer };
    if (previousUrl !== undefined) {
      attributes.previousUrl = previousUrl;
    }

    faro.api.setPage({ url: window.location.href, attributes });
  };

  // Landing page - emitted before any internal navigation.
  updatePageMeta();

  // Subsequent internal navigations within the SPA.
  locationService.getHistory().listen((location) => {
    // Only a pathname change means the user actually left the page. Query-param-only navigations
    // (time range, variables) keep the same pathname; advancing previousUrl on those would make it
    // point at the current page instead of the one the user came from.
    if (location.pathname !== currentPath) {
      previousUrl = currentPath;
      currentPath = location.pathname;
    }

    updatePageMeta();
  });
}
