import { getAPINamespace } from '@grafana/api-clients';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  SEARCH_API_VERSION,
  SEARCH_QUERY_KIND,
  type SearchQueryBody,
  type SearchResults,
  type WhereNode,
} from 'app/features/apiserver/search';

import { type KindSearchStarredKind } from './kinds';

/**
 * Resolves starred names of an app kind to titles and folders through the kind's own search
 * endpoint, `POST /apis/{group}/{version}/namespaces/{ns}/{plural}/search`, which the app platform
 * mounts for every served namespaced kind whose manifest enables search.
 */

// Server page-size cap for a single search request
const MAX_SEARCH_LIMIT = 500;

export interface StarredResource {
  name: string;
  /** The kind's plural, as the API serves it. */
  resource: string;
  title: string;
  folder: string;
  description: string;
  tags: string[];
}

export interface StarredResourceFilter {
  text?: string;
  tags?: string[];
  folder?: string;
}

/**
 * Titles and folders of the starred objects of a kind that the user may read. A kind whose API is
 * unavailable (plugin disabled, apiserver down, search not enabled for the kind) yields nothing:
 * its stars go unshown rather than failing the list around them.
 */
export async function searchStarredResources(
  kind: KindSearchStarredKind,
  names: string[],
  filter: StarredResourceFilter = {}
): Promise<StarredResource[]> {
  if (names.length === 0) {
    return [];
  }

  const leaves: WhereNode[] = [{ filter: { field: 'name', operator: 'In', values: names } }];
  if (filter.text && filter.text !== '*') {
    leaves.push({ text: { value: filter.text, fields: ['title', 'description'] } });
  }
  if (filter.tags?.length) {
    leaves.push({ filter: { field: 'tags', operator: 'All', values: filter.tags } });
  }
  if (filter.folder) {
    leaves.push({ filter: { field: 'folder', operator: 'In', values: [filter.folder] } });
  }
  const query: SearchQueryBody = {
    where: leaves.length === 1 ? leaves[0] : { and: leaves },
    fields: ['title', 'folder', 'description', 'tags'],
    limit: Math.min(names.length, MAX_SEARCH_LIMIT),
  };

  const url = `/apis/${kind.group}/${kind.version}/namespaces/${getAPINamespace()}/${kind.resource}/search`;
  let results: SearchResults;
  try {
    results = await getBackendSrv().post<SearchResults>(
      url,
      { apiVersion: SEARCH_API_VERSION, kind: SEARCH_QUERY_KIND, ...query },
      // The kind's stars are simply not shown; a global toast for an optional plugin API would only confuse
      { showErrorAlert: false }
    );
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

  return results.items.map((item) => {
    const fields = item.fields ?? {};
    return {
      name: item.resource.name,
      resource: item.resource.resource,
      title: typeof fields.title === 'string' && fields.title ? fields.title : item.resource.name,
      folder: typeof fields.folder === 'string' ? fields.folder : '',
      description: typeof fields.description === 'string' ? fields.description : '',
      tags: Array.isArray(fields.tags) ? fields.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    };
  });
}
