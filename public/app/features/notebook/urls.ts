import { config, locationService } from '@grafana/runtime';

import {
  NOTEBOOK_ENTRY_POINT,
  NOTEBOOK_LOAD_SOURCE,
  type NotebookEntryPoint,
  type NotebookLoadSource,
} from './analytics/types';

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
 * `?source=` says which surface a link to a notebook was on, so the `loaded` event can report where the
 * reader came from. Only the in-app links add it, and the notebook page takes it back off the url once
 * read, so a link copied from the address bar does not carry it along.
 */
const NOTEBOOK_SOURCE_PARAM = 'source';

/** The param a link carries for `source`. Nothing for `direct`, which is the absence of a link that said anything. */
function sourceParam(source: NotebookLoadSource | undefined): string {
  return source && source !== NOTEBOOK_LOAD_SOURCE.DIRECT ? `${NOTEBOOK_SOURCE_PARAM}=${source}` : '';
}

/**
 * The blank-notebook route. Nothing exists behind it: the page renders an empty notebook and the
 * resource is only created once there is something to save.
 */
export const NOTEBOOK_NEW_URL = `${NOTEBOOKS_BASE_URL}/new`;
const NOTEBOOK_CREATE_SOURCE_PARAM = 'notebookSource';

/**
 * Where the list's create button goes. A blank notebook exists only to be written into, so it opens
 * in edit mode, for the same reason `notebookEditUrl` below does.
 */
export function notebookNewEditUrl(): string {
  return `${NOTEBOOK_NEW_URL}?${NOTEBOOK_EDIT_PARAM}=${NOTEBOOK_EDIT_PARAM_ON}`;
}

/** Browser-facing new-notebook link, including the current org and Grafana sub-path. */
export function notebookNewEditHref(source?: NotebookEntryPoint): string {
  const search = new URLSearchParams({ [NOTEBOOK_EDIT_PARAM]: NOTEBOOK_EDIT_PARAM_ON });
  if (source) {
    search.set(NOTEBOOK_CREATE_SOURCE_PARAM, source);
  }
  return locationService.getHistory().createHref({ pathname: NOTEBOOK_NEW_URL, search: `?${search.toString()}` });
}

export function newNotebookEntryPoint(): NotebookEntryPoint {
  const source = new URLSearchParams(locationService.getLocation().search).get(NOTEBOOK_CREATE_SOURCE_PARAM);
  if (source === NOTEBOOK_ENTRY_POINT.COMMAND_PALETTE || source === NOTEBOOK_ENTRY_POINT.QUICK_ADD) {
    return source;
  }
  return NOTEBOOK_ENTRY_POINT.NOTEBOOK_LIST;
}

export function searchWithoutNotebookSource(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(NOTEBOOK_CREATE_SOURCE_PARAM);
  return `?${params.toString()}`;
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
export function notebookViewHref(uid: string, source?: NotebookLoadSource): string {
  const search = sourceParam(source);

  return locationService
    .getHistory()
    .createHref({ pathname: notebookViewUrl(uid), ...(search ? { search: `?${search}` } : {}) });
}

/** The same destination as `notebookViewUrl`, saying which surface the link is on. */
export function notebookViewUrlFrom(uid: string, source: NotebookLoadSource): string {
  const search = sourceParam(source);

  return search ? `${notebookViewUrl(uid)}?${search}` : notebookViewUrl(uid);
}

/** The same page, opened in edit mode. `createHref` merges orgId into the search it is given. */
export function notebookEditHref(uid: string, source?: NotebookLoadSource): string {
  const sourceSearch = sourceParam(source) ? `&${sourceParam(source)}` : '';

  return locationService.getHistory().createHref({
    pathname: notebookViewUrl(uid),
    search: `?${NOTEBOOK_EDIT_PARAM}=${NOTEBOOK_EDIT_PARAM_ON}${sourceSearch}`,
  });
}

/**
 * The source a link to a notebook should carry for a panel that was sent from `entryPoint`. The
 * assistant surfaces open notebooks in their own canvas, so they have no link of this kind to label.
 */
export function loadSourceForEntryPoint(entryPoint: NotebookEntryPoint): NotebookLoadSource {
  switch (entryPoint) {
    case NOTEBOOK_ENTRY_POINT.NOTEBOOK_LIST:
      return NOTEBOOK_LOAD_SOURCE.NOTEBOOK_LIST;
    case NOTEBOOK_ENTRY_POINT.EXPLORE:
      return NOTEBOOK_LOAD_SOURCE.EXPLORE;
    case NOTEBOOK_ENTRY_POINT.DASHBOARD_PANEL:
      return NOTEBOOK_LOAD_SOURCE.DASHBOARD_PANEL;
    case NOTEBOOK_ENTRY_POINT.PLUGIN:
      return NOTEBOOK_LOAD_SOURCE.PLUGIN;
    default:
      return NOTEBOOK_LOAD_SOURCE.DIRECT;
  }
}

/**
 * The source the url carries, or `direct` when it carries none. Checked against the known values: the
 * param is the user's to edit, and nothing outside the list may reach an analytics property.
 */
export function readNotebookLoadSource(): NotebookLoadSource {
  const value = new URLSearchParams(locationService.getLocation().search).get(NOTEBOOK_SOURCE_PARAM);

  return Object.values(NOTEBOOK_LOAD_SOURCE).find((known) => known === value) ?? NOTEBOOK_LOAD_SOURCE.DIRECT;
}

/** Takes the source param back off the url once it has been read. A replace, so Back does not return to it. */
export function removeNotebookLoadSourceParam(): void {
  if (new URLSearchParams(locationService.getLocation().search).has(NOTEBOOK_SOURCE_PARAM)) {
    locationService.partial({ [NOTEBOOK_SOURCE_PARAM]: null }, true);
  }
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
 * The chromeless route the PDF export points the headless browser at (see export/openNotebookPdf).
 *
 * `render` is a static segment, which a v6 `<Routes>` ranks above the view route's `:slug?`, so it
 * cannot be swallowed as one. Raw, with no sub-path applied, like `notebookViewUrl`.
 */
export function notebookRenderUrl(uid: string): string {
  return `${notebookViewUrl(uid)}/render`;
}
