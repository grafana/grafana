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
