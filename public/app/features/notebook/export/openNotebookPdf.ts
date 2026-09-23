import { coerce, gte } from 'semver';

import { dateTime, locationUtil, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { notebookRenderUrl } from '../urls';

/** Whatever a caller has on hand for the notebook's current time range — see NotebookExportMenu. */
interface NotebookPdfTimeRange {
  from: string;
  to: string;
  timezone?: string;
}

/**
 * The image-renderer version PDF output arrived in. Kept in step with the `PdfRendering` capability
 * the backend declares in pkg/services/rendering/rendering.go — there is no bootdata field for the
 * capability itself, only the renderer's version.
 */
const PDF_RENDERING_MIN_VERSION = '3.10.0';

/**
 * Whether the configured image renderer can produce a PDF at all, which is a narrower question than
 * whether one is configured: `/render` rejects `encoding=pdf` unless the renderer satisfies the
 * `PdfRendering` capability. Without checking here, an install on an older renderer would be offered
 * an export that can only ever come back a render error.
 *
 * Fails closed on a version that cannot be read, which covers a renderer whose version Grafana has
 * not managed to fetch yet — the backend's own semver parse rejects that case too.
 *
 * `coerce` rather than `valid` to match the leniency of that parse, which accepts a partial or
 * `v`-prefixed version.
 */
export function canExportNotebookPdf(): boolean {
  if (!config.rendererAvailable) {
    return false;
  }

  const version = coerce(config.rendererVersion);

  return version !== null && gte(version, PDF_RENDERING_MIN_VERSION);
}

/**
 * Opens a blank tab, synchronously — call this as the first thing the click handler does, before
 * any `await`. A browser's transient user activation from the click only lasts a short window;
 * `window.open` after an awaited fetch (the list menu's `getSpec` goes over the network) can easily
 * outlast it and get treated as an unrequested popup. Navigating this tab later, once the render url
 * is ready, carries no such restriction.
 *
 * Deliberately no `noopener`/`noreferrer`: either one makes `window.open` return null
 * unconditionally, on success or not, which would make every export report as blocked. There's no
 * tabnabbing risk to guard against here anyway — the destination is a Grafana-internal render url,
 * not user-supplied content.
 */
export function openBlankNotebookPdfTab(): Window | null {
  return window.open('', '_blank');
}

/**
 * Navigates a tab opened by `openBlankNotebookPdfTab` to a server-rendered PDF of the notebook —
 * the same way dashboards' PDF export does, rather than a silent background download. Not
 * client-side, unlike the markdown exports: panels are live Scenes charts, and only a real headless
 * render (the same `/render` pipeline dashboards' "Export as image" uses) captures them faithfully.
 */
export function navigateToNotebookPdf(tab: Window, uid: string, timeRange: NotebookPdfTimeRange): void {
  tab.location.href = buildRenderUrl(uid, timeRange);
}

function buildRenderUrl(uid: string, timeRange: NotebookPdfTimeRange): string {
  // Resolved once and sent under both names: `timezone` is what the notebook's own $timeRange scene
  // object reads via its ordinary url sync, while `tz` is a separate, backend-only concept the
  // renderer uses to configure the *headless browser's* own timezone (see rendering.go). Neither
  // understands the bare 'browser' sentinel a scene otherwise resolves against the actual reader's
  // browser — meaningless to a headless one with no reader behind it — so it has to become a
  // concrete zone before either leg of the trip.
  const timezone = timeRange.timezone && resolveRenderTimeZone(timeRange.timezone);

  // Root-relative and run through `assureBaseUrl`, which prefixes whatever sub-path Grafana is
  // served under — the same way every other internal `window.open`/`href` in Grafana builds one.
  // A relative url would work too, but only by way of the base url a browser picks for the
  // `about:blank` tab this navigates, which has no `<base href>` of its own; spelling the sub-path
  // out leaves nothing resting on that.
  //
  // The path is the notebook's chromeless render route, which is what makes this a document: no app
  // chrome, no toolbar, no controls row, and page geometry of its own. Nothing here has to ask for
  // that — `kiosk`/`hideNav` used to, back when this pointed at the ordinary notebook page.
  const path = locationUtil.assureBaseUrl(`/render${notebookRenderUrl(uid)}`);

  return urlUtil.renderUrl(path, {
    // For the render pipeline, not the page: read server-side to pick a PDF over a PNG (see
    // pkg/api/render.go).
    encoding: 'pdf',
    orgId: String(contextSrv.user.orgId),
    // The notebook's own $timeRange scene object has the usual from/to/timezone url sync any Scenes
    // time range gets for free — without these, a fresh page load falls back to the notebook's saved
    // range rather than whatever a reader currently has picked, which the notebook deliberately never
    // persists on its own. Only included when set: an empty value would otherwise sit in the query
    // string rather than being left out, since toUrlParams renders undefined as '' rather than
    // omitting it.
    from: timeRange.from,
    to: timeRange.to,
    ...(timezone && { timezone, tz: timezone }),
  });
}

/**
 * Same resolution dashboards' own share/render links use (see `getRenderTimeZone` in
 * ShareLinkTab.tsx) — duplicated rather than imported, since it's a small private helper in an
 * unrelated feature. 'browser' means "whatever the current viewer's timezone is", which a headless
 * renderer has no reader behind it to ask, so it has to be resolved to a concrete zone up front.
 */
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
