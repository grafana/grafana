import { type Faro } from '@grafana/faro-core';
import { PersistentSessionsManager, VolatileSessionsManager } from '@grafana/faro-web-sdk';
import { locationService } from '@grafana/runtime';
import { isUrlRewrite } from 'app/core/navigation/urlRewrite';

/**
 * Enriches the `meta` of every Faro signal (web-vitals, dashboard_render, errors, traces, ...)
 * with navigation and session context the SPA referrer chain would otherwise hide:
 *
 * - `referrer`: the external entry point that brought the user to Grafana (`document.referrer`),
 *   captured once per page load. Lets the metrics pipeline attribute traffic to its source
 *   (e.g. an issue tracker, an email link). Omitted on direct navigations (empty referrer).
 * - `previousUrl`: the internal (virtual) route the user navigated from. Because Grafana is an SPA,
 *   the browser referrer does not change on internal navigation, so we track it ourselves. Absent
 *   on the landing page - the receiver reads "no previousUrl" as a session entry point. Pathname
 *   only, deliberately: query strings carry high-cardinality variable values.
 * - `sessionStart`: epoch millis when the current Faro session began. Emitting the start anchor
 *   rather than a precomputed length keeps it correct for every signal: the receiver derives
 *   `sessionLength = signalTimestamp - sessionStart`, whereas a length written here would be stale
 *   for every signal emitted between updates. Sessions persist across reloads, so the start can
 *   predate this page load.
 *
 * All three live in `page.attributes` so they ride on every emitted signal. Meta attributes are
 * string-only, so absent values are omitted rather than encoded as a literal null.
 *
 * Returns a refresh callback. Faro rotates sessions on expiration/inactivity without any
 * navigation happening (kiosk dashboards can sit on one route for hours), which would leave a
 * stale `sessionStart` next to the new `session.id`. The backend wires this callback to
 * `sessionTracking.onSessionChange` so rotation re-anchors the page meta immediately.
 */
export function setupFaroPageMeta(faro: Faro): () => void {
  // Captured once: the external source for this load stays constant across internal navigation.
  const referrer = document.referrer;

  // previousPath/currentPath are tracked separately so a session-driven refresh can re-emit the
  // attributes without shifting the navigation chain.
  let previousPath: string | undefined;
  let currentPath = locationService.getLocation().pathname;
  let lastEmittedSessionStart: string | undefined;

  // The session storage backend (localStorage vs sessionStorage) is picked by the
  // `sessionTracking.persistent` config in a different file. Rather than coupling to that flag,
  // read both stores and only trust the record matching the live session id - a stale record from
  // a previous configuration can look valid while describing a dead session.
  const fetchSessionStart = (): string | undefined => {
    const activeSessionId = faro.api.getSession()?.id;
    if (activeSessionId === undefined) {
      return undefined;
    }

    const stored = [PersistentSessionsManager.fetchUserSession(), VolatileSessionsManager.fetchUserSession()].find(
      (session) => session?.sessionId === activeSessionId
    );

    return stored ? String(stored.started) : undefined;
  };

  const applyPageMeta = () => {
    const attributes: Record<string, string> = {};
    if (referrer) {
      attributes.referrer = referrer;
    }
    if (previousPath !== undefined) {
      attributes.previousUrl = previousPath;
    }

    const sessionStart = fetchSessionStart();
    if (sessionStart !== undefined) {
      attributes.sessionStart = sessionStart;
    }
    lastEmittedSessionStart = sessionStart;

    faro.api.setPage({ url: window.location.href, attributes });
  };

  // Landing page - emitted before any internal navigation.
  applyPageMeta();

  // Subsequent history updates within the SPA. A pathname change shifts the previous/current
  // chain, with two exceptions that would otherwise make a page its own predecessor:
  // - entries flagged via `markAsUrlRewrite` (slug normalization after a dashboard loads,
  //   home-route resolution) - in-place URL corrections, not navigations. Unflagged REPLACEs
  //   count as navigations: redirects (post-login, post-save) are real transitions.
  // - same-pathname events, i.e. query-only churn (time range, variables).
  // Every event still re-emits so `page.url` tracks the full URL.
  locationService.getHistory().listen((location, action) => {
    const isRewrite = action === 'REPLACE' && isUrlRewrite(location.state);
    if (!isRewrite && location.pathname !== currentPath) {
      previousPath = currentPath;
    }
    currentPath = location.pathname;
    applyPageMeta();
  });

  // onSessionChange also fires on session extends, not only rotation; the guard keeps those from
  // re-emitting page meta (setPage itself notifies meta listeners) when nothing changed.
  return () => {
    if (fetchSessionStart() !== lastEmittedSessionStart) {
      applyPageMeta();
    }
  };
}
