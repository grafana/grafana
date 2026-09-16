import { config, locationService } from '@grafana/runtime';

export const NOTEBOOKS_BASE_URL = '/notebooks';

/**
 * `?edit=true` opens the notebook in edit mode. The mode itself is runtime React state; the param
 * only seeds it, so that the list's Edit action can land straight in edit mode and a reload keeps
 * you there.
 *
 * Matched exactly against 'true' rather than by presence, so that `?edit=false` means what it says.
 */
export const NOTEBOOK_EDIT_PARAM = 'edit';
export const NOTEBOOK_EDIT_PARAM_ON = 'true';

/**
 * `?pdfLayout=true` asks the page to lay itself out as a portrait document rather than a screen —
 * see `isNotebookPdfLayoutUrl` below for why this is the notebook's own param and not the render
 * pipeline's `encoding=pdf`.
 */
export const NOTEBOOK_PDF_LAYOUT_PARAM = 'pdfLayout';
export const NOTEBOOK_PDF_LAYOUT_PARAM_ON = 'true';

/**
 * The blank-notebook route. Nothing exists behind it: the page renders an empty notebook and the
 * resource is only created once there is something to save.
 */
export const NOTEBOOK_NEW_URL = `${NOTEBOOKS_BASE_URL}/new`;

/**
 * Where the list's create button goes. A blank notebook exists only to be written into, so it opens
 * in edit mode, for the same reason `notebookEditUrl` below does.
 */
export function notebookNewEditUrl(): string {
  return `${NOTEBOOK_NEW_URL}?${NOTEBOOK_EDIT_PARAM}=${NOTEBOOK_EDIT_PARAM_ON}`;
}

/**
 * The single-notebook destination, nested under the list so the two stay consistent. The list's
 * title link points here; its Edit action points at the same page with the edit param.
 *
 * Raw, with no sub-path applied: react-router (`useNavigate`) and `Link`/`TextLink` apply the
 * base themselves, so prefixing here would double it.
 */
export function notebookViewUrl(uid: string): string {
  return `${NOTEBOOKS_BASE_URL}/${uid}`;
}

/**
 * The same destination in edit mode, for router-based navigation (`useNavigate`) — a freshly created
 * notebook is empty and exists only to be written into, so creation lands here rather than on the
 * view route a reader would otherwise see first. `notebookEditHref` below is the equivalent for
 * consumers that render a plain `<a>` instead of navigating through the router.
 */
export function notebookEditUrl(uid: string): string {
  return `${notebookViewUrl(uid)}?${NOTEBOOK_EDIT_PARAM}=${NOTEBOOK_EDIT_PARAM_ON}`;
}

/**
 * The same destination for consumers that render a plain `<a>` and so never see the router —
 * `LinkButton`, for one. `createHref` applies the sub-path and carries `orgId`; notebooks are
 * org-scoped, so a link without it opens whichever org the reader happens to be in.
 */
export function notebookViewHref(uid: string): string {
  return locationService.getHistory().createHref({ pathname: notebookViewUrl(uid) });
}

/** The same page, opened in edit mode. `createHref` merges orgId into the search it is given. */
export function notebookEditHref(uid: string): string {
  return locationService
    .getHistory()
    .createHref({ pathname: notebookViewUrl(uid), search: `?${NOTEBOOK_EDIT_PARAM}=${NOTEBOOK_EDIT_PARAM_ON}` });
}

/** Absolute URL, for copying a link to share outside the current tab. */
export function notebookShareUrl(uid: string): string {
  return new URL(notebookViewHref(uid), config.appUrl).href;
}

/**
 * Whether the url asks for edit mode, for callers that run before the scene syncs with it.
 * `NotebookSceneUrlSync` answers the same question from the values the sync manager hands it.
 *
 * `getSearchObject` turns 'true' into a boolean, so it cannot tell `?edit=true` from `?edit=1`.
 * This reads the raw string instead.
 */
export function isNotebookEditUrl(): boolean {
  const search = new URLSearchParams(locationService.getLocation().search);

  return search.get(NOTEBOOK_EDIT_PARAM) === NOTEBOOK_EDIT_PARAM_ON;
}

/**
 * Whether the url asks this page to lay itself out as a portrait document rather than a screen —
 * set by the PDF export (see openNotebookPdf), and reaching the page because Grafana builds the
 * headless browser's target url from the whole `/render/...` request's raw query string, the same
 * way `kiosk`/`hideNav` arrive.
 *
 * Deliberately a param this feature owns, rather than reading the render pipeline's own
 * `encoding=pdf`: that one belongs to the transport (`pkg/api/render.go` reads it to pick a render
 * type), and a page that keys its layout off it would break the moment that signalling changes.
 * Grafana's own reporting does the same thing, sending its `pdf.*` layout params alongside
 * `encoding` rather than inferring one from the other.
 *
 * Matched exactly against 'true', for the same reason `isNotebookEditUrl` is.
 */
export function isNotebookPdfLayoutUrl(): boolean {
  const search = new URLSearchParams(locationService.getLocation().search);

  return search.get(NOTEBOOK_PDF_LAYOUT_PARAM) === NOTEBOOK_PDF_LAYOUT_PARAM_ON;
}
