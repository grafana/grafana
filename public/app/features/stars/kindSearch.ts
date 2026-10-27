import { getAPINamespace } from '@grafana/api-clients';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  discoveryResources,
  getAPIGroupDiscoveryList,
  type GroupDiscoveryResource,
} from 'app/features/apiserver/discovery';
import {
  SEARCH_API_VERSION,
  SEARCH_QUERY_KIND,
  type SearchQueryBody,
  type SearchResults,
  type WhereNode,
} from 'app/features/apiserver/search';

import { type StarredKind } from './kinds';

/**
 * Resolves starred names of a plugin kind to titles and folders through the kind's own search
 * endpoint, `POST /apis/{group}/{version}/namespaces/{ns}/{plural}/search`, which the app platform
 * mounts for every served namespaced kind whose manifest enables search. The served version and
 * plural come from API discovery, so a plugin declares only its group and kind, and a version bump
 * needs no change here.
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

// Resolved once per page load: the set of served kinds is static for the apiserver process
// lifetime. Failures are not cached so a transient outage can be retried by the next caller.
let servedResources: Promise<GroupDiscoveryResource[]> | undefined;

function getServedResources(): Promise<GroupDiscoveryResource[]> {
  if (!servedResources) {
    const pending = getAPIGroupDiscoveryList().then(discoveryResources);
    servedResources = pending;
    pending.catch(() => {
      if (servedResources === pending) {
        servedResources = undefined;
      }
    });
  }
  return servedResources;
}

/** `/apis/{group}/{version}/namespaces/{ns}/{plural}` of a kind, as this Grafana serves it. */
async function resourceBaseURL(kind: StarredKind): Promise<string> {
  const resources = await getServedResources();
  // Discovery lists a group's versions by preference, so the first match is the preferred one
  const served = resources.find(
    (resource) => resource.responseKind.group === kind.group && resource.responseKind.kind === kind.kind
  );
  if (!served) {
    throw new Error(`Kind ${kind.group}/${kind.kind} is not served`);
  }
  return `/apis/${kind.group}/${served.responseKind.version}/namespaces/${getAPINamespace()}/${served.resource}`;
}

/**
 * Titles and folders of the starred objects of a kind that the user may read. A kind whose API is
 * unavailable (plugin disabled, apiserver down, search not enabled for the kind) yields nothing:
 * its stars go unshown rather than failing the list around them.
 */
export async function searchStarredResources(
  kind: StarredKind,
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

  let results: SearchResults;
  try {
    results = await getBackendSrv().post<SearchResults>(
      `${await resourceBaseURL(kind)}/search`,
      { apiVersion: SEARCH_API_VERSION, kind: SEARCH_QUERY_KIND, ...query },
      // The kind's stars are simply not shown; a global toast for an optional plugin API would only confuse
      { showErrorAlert: false }
    );
  } catch (err) {
    if (isFetchError(err) && err.status === 404) {
      // The route is only mounted for kinds whose app manifest enables search
      console.warn(
        `Plugin ${kind.pluginId} declares ${kind.group}/${kind.kind} as starrable, but the kind's app manifest does not enable search, so its stars cannot be shown`
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
