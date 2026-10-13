import { coerce, gte } from 'semver';

import { dateTime, locationUtil, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { notebookRenderUrl } from '../urls';

interface NotebookPdfTimeRange {
  from: string;
  to: string;
  timezone?: string;
}

/** Kept in step with the `PdfRendering` capability in pkg/services/rendering/rendering.go. */
const PDF_RENDERING_MIN_VERSION = '3.10.0';

/**
 * Narrower than whether a renderer is configured: `/render` rejects `encoding=pdf` unless the
 * renderer satisfies the `PdfRendering` capability, and only its version is exposed to the frontend.
 * Fails closed on an unreadable version, which is the case the backend rejects too.
 */
export function canExportNotebookPdf(): boolean {
  if (!config.rendererAvailable) {
    return false;
  }

  const version = coerce(config.rendererVersion);

  return version !== null && gte(version, PDF_RENDERING_MIN_VERSION);
}

/**
 * Call this before any `await`: the click's transient user activation expires, and a `window.open`
 * after an awaited fetch gets treated as an unrequested popup. Navigating the tab later does not.
 *
 * No `noopener`/`noreferrer` — either makes `window.open` return null even on success, which would
 * report every export as blocked.
 */
export function openBlankNotebookPdfTab(): Window | null {
  return window.open('', '_blank');
}

/** Server-rendered rather than client-side: panels are live Scenes charts. */
export function navigateToNotebookPdf(tab: Window, uid: string, timeRange: NotebookPdfTimeRange): void {
  tab.location.href = buildRenderUrl(uid, timeRange);
}

function buildRenderUrl(uid: string, timeRange: NotebookPdfTimeRange): string {
  // Sent under both names: `timezone` feeds the scene's url sync, `tz` sets the headless browser's
  // own timezone. Neither understands the 'browser' sentinel, which has no reader to resolve
  // against, so it becomes a concrete zone first.
  const timezone = timeRange.timezone && resolveRenderTimeZone(timeRange.timezone);

  // Root-relative through `assureBaseUrl`, so the sub-path is spelled out rather than left to the
  // base url a browser picks for the `about:blank` tab this navigates.
  const path = locationUtil.assureBaseUrl(`/render${notebookRenderUrl(uid)}`);

  return urlUtil.renderUrl(path, {
    encoding: 'pdf',
    orgId: String(contextSrv.user.orgId),
    // Without these a fresh load falls back to the saved range rather than the one on screen, which
    // the notebook never persists. Omitted when unset, since toUrlParams renders undefined as ''.
    from: timeRange.from,
    to: timeRange.to,
    ...(timezone && { timezone, tz: timezone }),
  });
}

/** Same resolution as `getRenderTimeZone` in ShareLinkTab, duplicated rather than exported. */
function resolveRenderTimeZone(timeZone: string): string {
  if (timeZone === 'utc') {
    return 'UTC';
  }

  if (timeZone !== 'browser') {
    return timeZone;
  }

  const utcOffset = 'UTC' + encodeURIComponent(dateTime().format('Z'));
  if (!window.Intl) {
    return utcOffset;
  }

  return window.Intl.DateTimeFormat().resolvedOptions().timeZone || utcOffset;
}
