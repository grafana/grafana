import { chunk } from 'lodash';

import {
  API_GROUP as SEARCH_API_GROUP,
  API_VERSION as SEARCH_API_VERSION,
  generatedAPI as searchAPI,
  type GlobalResultItem,
  type GlobalSearchQuery,
  type GlobalSearchResults,
} from '@grafana/api-clients/rtkq/search/v0alpha1';
import { locationUtil } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import { getAPIGroupVersions } from 'app/features/apiserver/discovery';
import { type DashboardQueryResult } from 'app/features/search/service/types';

import { STARRED_APP_KINDS, type StarredAppKind } from './kinds';

/**
 * TODO: Switch to the global search when it is enabled, and delete this file. One search across
 * kinds then answers for all of them, where this takes a request per kind. It is off by default
 * on the server for now.
 *
 * Resolves starred names of an app kind to titles and folders through the kind's own search
 * endpoint, `POST /apis/{group}/{version}/namespaces/{ns}/{plural}/search`, which the app platform
 * mounts for every served namespaced kind whose manifest does not opt out of search. No client is
 * generated for an app kind, so the request is built here. Its query and results are those of the
 * global search, less what only a search across kinds has, so the types are that client's.
 */

// Server page-size cap for a single search request
const MAX_SEARCH_LIMIT = 500;

/** Tag for the starred rows of app kinds, which are searched apart from the dashboards and folders. */
const STARRED_APP_SEARCH_TAG = 'StarredAppSearch';

/** The starred names of one app kind, by its search kind. */
interface StarredAppNames {
  kind: string;
  names: string[];
}

/**
 * The objects with these names, which are no more than a page holds. A name matches one object at most, so one
 * request can answer for them all, but the server may still cut a page short. It then hands out a token for the
 * rest, which is followed until every name is accounted for. A page accounts for one name at least, so there are
 * no more pages than names, and a server that hands out a token with every page is not asked forever.
 */
async function searchNames(url: string, names: string[]): Promise<GlobalResultItem[]> {
  const items: GlobalResultItem[] = [];
  let token: string | undefined;
  for (let page = 0; page < names.length; page++) {
    const query: GlobalSearchQuery = {
      // The server refuses a query without its envelope
      apiVersion: `${SEARCH_API_GROUP}/${SEARCH_API_VERSION}`,
      kind: 'SearchQuery',
      where: { filter: { field: 'name', operator: 'In', values: names } },
      fields: ['title', 'folder', 'description', 'tags'],
      limit: names.length,
      continue: token,
    };
    const results = await getBackendSrv().post<GlobalSearchResults>(
      url,
      query,
      // The kind's stars are simply not shown; a global toast for an optional plugin API would only confuse
      { showErrorAlert: false }
    );
    items.push(...results.items);
    token = results.metadata.continue;
    if (!token || items.length >= names.length) {
      break;
    }
  }
  return items;
}

/**
 * The starred objects of a kind that the user may read, as search rows carrying their kind and url. A kind whose
 * API is unavailable (plugin not installed, apiserver down, search opted out of) yields nothing: its stars go
 * unshown rather than failing the list around them.
 */
async function searchStarredRows(kind: StarredAppKind, names: string[]): Promise<DashboardQueryResult[]> {
  let items: GlobalResultItem[];
  try {
    // Asked with every search, not kept: an update of the plugin may change the version it serves. The kind is
    // taken to be served at its group's preferred version
    const group = await getAPIGroupVersions(kind.group);
    const version = group?.preferred ?? group?.versions.values().next().value;
    if (!version) {
      // The instance does not serve the group: the plugin is not installed
      return [];
    }
    const url = `${getAPIBaseURL(kind.group, version)}/${kind.resource}/search`;
    // The requests succeed or fail together: part of a kind's stars would read as all of them
    const batches = await Promise.all(chunk(names, MAX_SEARCH_LIMIT).map((batch) => searchNames(url, batch)));
    items = batches.flat();
  } catch (err) {
    if (isFetchError(err) && err.status === 405) {
      // The kind is served with no search endpoint: it opted out of search, or it is not namespaced
      console.warn(
        `${kind.group}/${kind.kind} can be starred, but it is served without a search endpoint, so its stars cannot be shown`
      );
    } else {
      console.error(`Failed to resolve starred ${kind.group}/${kind.kind}`, err);
    }
    return [];
  }

  return items.map((item) => {
    const fields = item.fields ?? {};
    const { name } = item.resource;
    return {
      kind: kind.searchKind,
      uid: name,
      name: typeof fields.title === 'string' && fields.title ? fields.title : name,
      // A kind's route leaves out the app sub path, which a link carries
      url: locationUtil.assureBaseUrl(kind.getRoute(name)),
      description: typeof fields.description === 'string' ? fields.description : '',
      location: typeof fields.folder === 'string' ? fields.folder : '',
      tags: Array.isArray(fields.tags) ? fields.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      panel_type: '',
      ds_uid: [],
    };
  });
}

// An endpoint of the search client, not of the stars client: a request that is still out holds back every
// invalidation in the client it belongs to, and a star toggle must not wait for a plugin's API
const kindSearchAPI = searchAPI.enhanceEndpoints({ addTagTypes: [STARRED_APP_SEARCH_TAG] }).injectEndpoints({
  endpoints: (build) => ({
    /** Starred objects of app kinds as search rows, each kind through its own search endpoint, in no order. */
    searchStarredAppKinds: build.query<DashboardQueryResult[], StarredAppNames[]>({
      providesTags: [STARRED_APP_SEARCH_TAG],
      queryFn: async (starred) => {
        const rows = await Promise.all(
          starred.map(({ kind: searchKind, names }) => {
            const kind = STARRED_APP_KINDS.find((candidate) => candidate.searchKind === searchKind);
            return kind ? searchStarredRows(kind, names) : [];
          })
        );
        return { data: rows.flat() };
      },
    }),
  }),
});

/** Re-searches the starred rows of app kinds, for a view that refreshes on its own schedule. */
export const refetchStarredAppKinds = () => kindSearchAPI.util.invalidateTags([STARRED_APP_SEARCH_TAG]);

export const { useSearchStarredAppKindsQuery } = kindSearchAPI;
