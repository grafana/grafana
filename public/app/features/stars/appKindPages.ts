import { countBy } from 'lodash';

import { locationUtil, type NavModelItem } from '@grafana/data';
import { store } from 'app/store/store';

/**
 * TODO: Temporary. Delete this file once an app manifest can declare the page of a kind (`ui.path`),
 * and read that path instead. The change that adds it is made outside this repository.
 *
 * Until then, a kind's list page is taken to be the plugin page in the nav tree whose path ends in
 * the kind's plural, e.g. `/a/grafana-irm-app/incidents` for `incidents`, and an object's page is
 * that path plus its name. A kind with no such page, or with several, is not shown; neither is a
 * kind whose page the plugin keeps out of the nav, nor one whose plural a kind of another group
 * shares, since a page does not say which of the two it lists. Nothing else in the stars code
 * knows how a page is found.
 */

/** Paths of the app plugin pages in the nav tree, without the app sub url, query or trailing slash. */
function pluginPagePaths(): string[] {
  const paths = new Set<string>();
  const visit = (items: NavModelItem[]) => {
    for (const item of items) {
      const path = item.url && locationUtil.stripBaseFromUrl(item.url).split(/[?#]/)[0].replace(/\/$/, '');
      if (path?.startsWith('/a/')) {
        paths.add(path);
      }
      if (item.children) {
        visit(item.children);
      }
    }
  };
  visit(store.getState().navBarTree);
  return [...paths];
}

/**
 * Resolves a kind's plural to its list page, over the nav tree as it stands when called. `plurals` holds the
 * plural of every kind that may have a page, so a plural it holds twice belongs to two kinds and resolves to none.
 */
export function appKindListPathResolver(plurals: string[]): (plural: string) => string | undefined {
  const pages = pluginPagePaths();
  const kindsByPlural = countBy(plurals);
  return (plural) => {
    const matches = pages.filter((path) => path.endsWith(`/${plural}`));
    return matches.length === 1 && kindsByPlural[plural] === 1 ? matches[0] : undefined;
  };
}
