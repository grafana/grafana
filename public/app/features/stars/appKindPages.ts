import { ASSISTANT_PAGES_PATH } from 'app/core/constants';

/**
 * TODO: Temporary. Delete this file once an app manifest can declare the page of a kind (`ui.path`),
 * and read that path instead. The change that adds it is made outside this repository.
 *
 * Until then, the page that lists a kind's objects is named here, by API group and kind, and an object's
 * page is that path plus its name. A kind without an entry has no page Grafana knows of, so its stars
 * are not shown. Nothing else in the stars code knows where a page is.
 */
const LIST_PATHS: Record<string, string> = {
  'assistant.ext.grafana.app/Page': ASSISTANT_PAGES_PATH,
};

/** The page that lists the objects of an app kind, without the app sub url. */
export function appKindListPath(group: string, kind: string): string | undefined {
  return LIST_PATHS[`${group}/${kind}`];
}
