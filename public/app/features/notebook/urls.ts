import { config, locationService } from '@grafana/runtime';

export const NOTEBOOKS_BASE_URL = '/notebooks';

/**
 * The single-notebook destination, nested under the list so the two stay consistent. Until a
 * notebook editor exists this is the read-only scene page, and both the list's title link and
 * its Edit action point here — routing everything through this helper keeps that one place to
 * change once the editor lands.
 *
 * Raw, with no sub-path applied: react-router (`useNavigate`) and `Link`/`TextLink` apply the
 * base themselves, so prefixing here would double it.
 */
export function notebookViewUrl(uid: string): string {
  return `${NOTEBOOKS_BASE_URL}/${uid}`;
}

/**
 * The same destination for consumers that render a plain `<a>` and so never see the router —
 * `LinkButton`, for one. `createHref` applies the sub-path and carries `orgId`; notebooks are
 * org-scoped, so a link without it opens whichever org the reader happens to be in.
 */
export function notebookViewHref(uid: string): string {
  return locationService.getHistory().createHref({ pathname: notebookViewUrl(uid) });
}

/** Absolute URL, for copying a link to share outside the current tab. */
export function notebookShareUrl(uid: string): string {
  return new URL(notebookViewHref(uid), config.appUrl).href;
}
