import { chunk } from 'lodash';

import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import {
  SEARCH_API_VERSION,
  SEARCH_QUERY_KIND,
  type SearchQueryBody,
  type SearchResultItem,
  type SearchResults,
  type WhereNode,
} from 'app/features/apiserver/search';
import { type SearchHit } from 'app/features/search/service/unified';

import { type KindSearchStarredKind, type StarredNamesOfKind } from './kinds';

/**
 * Resolves starred names of an app kind to titles and folders through the kind's own search
 * endpoint, `POST /apis/{group}/{version}/namespaces/{ns}/{plural}/search`, which the app platform
 * mounts for every served namespaced kind whose manifest enables search.
 */

// Server page-size cap for a single search request
const MAX_SEARCH_LIMIT = 500;

// Created once, not per sort
const collator = new Intl.Collator();

export interface StarredResourceFilter {
  text?: string;
  tags?: string[];
  folder?: string;
}

/**
 * The starred objects of a kind that the user may read, as search hits carrying their kind and url. A kind whose
 * API is unavailable (plugin disabled, apiserver down, search not enabled for the kind) yields nothing: its stars
 * go unshown rather than failing the list around them.
 */
export async function searchStarredHits(
  kind: KindSearchStarredKind,
  names: string[],
  filter: StarredResourceFilter = {}
): Promise<SearchHit[]> {
  if (names.length === 0) {
    return [];
  }

  const filterLeaves: WhereNode[] = [];
  if (filter.text && filter.text !== '*') {
    filterLeaves.push({ text: { value: filter.text, fields: ['title', 'description'] } });
  }
  if (filter.tags?.length) {
    filterLeaves.push({ filter: { field: 'tags', operator: 'All', values: filter.tags } });
  }
  if (filter.folder) {
    filterLeaves.push({ filter: { field: 'folder', operator: 'In', values: [filter.folder] } });
  }

  const url = `${getAPIBaseURL(kind.group, kind.version)}/${kind.resource}/search`;
  let items: SearchResultItem[];
  try {
    // A name matches one object at most, so a request for no more names than the page cap is never cut short.
    // The requests succeed or fail together: part of a kind's stars would read as all of them
    const pages = await Promise.all(
      chunk(names, MAX_SEARCH_LIMIT).map((values) => {
        const leaves: WhereNode[] = [{ filter: { field: 'name', operator: 'In', values } }, ...filterLeaves];
        const query: SearchQueryBody = {
          where: leaves.length === 1 ? leaves[0] : { and: leaves },
          fields: ['title', 'folder', 'description', 'tags'],
          limit: values.length,
        };
        return getBackendSrv().post<SearchResults>(
          url,
          { apiVersion: SEARCH_API_VERSION, kind: SEARCH_QUERY_KIND, ...query },
          // The kind's stars are simply not shown; a global toast for an optional plugin API would only confuse
          { showErrorAlert: false }
        );
      })
    );
    items = pages.flatMap((page) => page.items);
  } catch (err) {
    if (isFetchError(err) && err.status === 404) {
      // The route is only mounted for kinds whose app manifest enables search
      console.warn(
        `${kind.group}/${kind.kind} can be starred, but its app manifest does not enable search, so its stars cannot be shown`
      );
    } else {
      console.error(`Failed to resolve starred ${kind.group}/${kind.kind}`, err);
    }
    return [];
  }

  return items.map((item) => {
    const fields = item.fields ?? {};
    const { name, resource } = item.resource;
    return {
      resource,
      kind: kind.searchKind,
      name,
      title: typeof fields.title === 'string' && fields.title ? fields.title : name,
      folder: typeof fields.folder === 'string' ? fields.folder : '',
      description: typeof fields.description === 'string' ? fields.description : '',
      tags: Array.isArray(fields.tags) ? fields.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      field: {},
      url: kind.url(name),
    };
  });
}

/**
 * The starred objects of several app kinds, each through its own search endpoint, as one list in title order.
 * Ordered here: each kind answers on its own, so no server can order the rows of several kinds.
 */
export async function searchAppKindHits(
  entries: ReadonlyArray<StarredNamesOfKind<KindSearchStarredKind>>,
  filter?: StarredResourceFilter,
  titleOrder: 'asc' | 'desc' = 'asc'
): Promise<SearchHit[]> {
  const hits = await Promise.all(entries.map(({ kind, names }) => searchStarredHits(kind, names, filter)));
  const direction = titleOrder === 'desc' ? -1 : 1;
  return hits.flat().sort((a, b) => direction * collator.compare(a.title, b.title));
}
