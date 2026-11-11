import { locationUtil } from '@grafana/data';
import { ASSISTANT_PAGES_PATH, ASSISTANT_PLUGIN_ID } from 'app/core/constants';

export const PAGE_VIEW_COMPONENT_ID = `${ASSISTANT_PLUGIN_ID}/page-view/v1`;

// Both reference forms end in twelve hex characters: the slug form by construction, a UUID in its
// last group. Sibling routes such as `pages/new` or `pages/templates` never do.
const PAGE_REF = /^(?:.*-)?[0-9a-f]{12}$/i;

/** The page a home URL points at, when it names a single Grafana Page rather than any other route. */
export function getHomePageRef(homeURL: string | undefined): string | undefined {
  if (!homeURL) {
    return undefined;
  }
  const path = locationUtil.stripBaseFromUrl(homeURL).split(/[?#]/)[0];
  if (!path.startsWith(`${ASSISTANT_PAGES_PATH}/`)) {
    return undefined;
  }
  const [ref, ...rest] = path.slice(ASSISTANT_PAGES_PATH.length + 1).split('/');
  // Only `pages/:id/:slug?` is a page; anything deeper is another Assistant route.
  if (rest.length > 1 || !PAGE_REF.test(ref)) {
    return undefined;
  }
  return ref;
}
