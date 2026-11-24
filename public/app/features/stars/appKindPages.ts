import { ASSISTANT_PAGES_PATH } from 'app/core/constants';

/** An app kind Grafana shows stars of, as its API names it, with the page that lists its objects. */
interface AppKindPage {
  group: string;
  kind: string;
  /** The plural the kind's API serves it under. Not looked up: if the API renames it, change it here */
  resource: string;
  /** Without the app sub url. An object's page is this path plus its name */
  listPath: string;
}

/**
 * TODO: Temporary. Delete this file once an app manifest can declare the page of a kind (`ui.path`),
 * and read that path instead. The change that adds it is made outside this repository.
 *
 * Until then, the app kinds Grafana shows stars of are named here. A kind without an entry has no page
 * Grafana knows of, so its stars are not shown. Nothing else in the stars code knows where a page is.
 */
export const APP_KIND_PAGES: readonly AppKindPage[] = [
  { group: 'assistant.ext.grafana.app', kind: 'Page', resource: 'pages', listPath: ASSISTANT_PAGES_PATH },
];
