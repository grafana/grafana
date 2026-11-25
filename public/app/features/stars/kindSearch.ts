import { chunk } from 'lodash';

import { type ResultItem, type SearchQuery, type SearchResults } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import {
  API_GROUP as SEARCH_GROUP,
  API_VERSION as SEARCH_VERSION,
  generatedAPI as searchAPI,
} from '@grafana/api-clients/rtkq/search/v0alpha1';
import { locationUtil } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { getAPIBaseURL } from 'app/api/utils';
import { getAPIGroupVersions } from 'app/features/apiserver/discovery';
import { type ThunkResult } from 'app/types/store';

import { getStarredAppKinds, type StarredAppKind } from './kinds';
import { type StarredNames, type StarredRow, starsHoldName, userStarsFieldSelector } from './utils';

/**
 * TODO: Switch to the global search when it is enabled, and delete this file. One search across
 * kinds then answers for all of them, where this takes a request per kind. It is off by default
 * on the server for now.
 *
 * Resolves starred names of an app kind to titles and folders through the kind's own search
 * endpoint, `POST /apis/{group}/{version}/namespaces/{ns}/{plural}/search`, which the app platform
 * mounts for every served namespaced kind whose manifest does not opt out of search. No client is
 * generated for an app kind, so the request is built here. Every kind's search takes the same query
 * and answers with the same results, so the types are those generated for the dashboard kind's.
 */

const SEARCH_API_VERSION = `${SEARCH_GROUP}/${SEARCH_VERSION}`;

// Server page-size cap for a single search request
const MAX_SEARCH_LIMIT = 500;

/** Tag for the starred rows of app kinds, which are searched apart from the dashboards and folders. */
const STARRED_APP_SEARCH_TAG = 'StarredAppSearch';

/**
 * The search endpoint of a kind; undefined when the instance names no preferred version of the kind's group, as
 * when the plugin that serves it is not installed.
 */
async function resolveSearchURL(kind: StarredAppKind): Promise<string | undefined> {
  // TODO: Resolve the version through the shared API discovery service once there is one. Until then the kind
  // is taken to be served at its group's preferred version, which is asked for with every search, not kept:
  // an update of the plugin may change it
  const version = (await getAPIGroupVersions(kind.group))?.preferred;
  return version ? `${getAPIBaseURL(kind.group, version)}/${kind.resource}/search` : undefined;
}

/**
 * The objects with these names, which are no more than a page holds. A name matches one object at most, so one
 * request can answer for them all, but the server may still cut a page short. It then hands out a token for the
 * rest, which is followed until every name is accounted for. A page accounts for one name at least, so there are
 * no more pages than names, and a server that hands out a token with every page is not asked forever.
 */
async function searchNames(url: string, names: string[]): Promise<ResultItem[]> {
  const items: ResultItem[] = [];
  let token: string | undefined;
  for (let page = 0; page < names.length; page++) {
    const query: SearchQuery = {
      // The server refuses a query without its envelope
      apiVersion: SEARCH_API_VERSION,
      kind: 'SearchQuery',
      where: { filter: { field: 'name', operator: 'In', values: names } },
      fields: ['title', 'folder', 'description'],
      limit: names.length,
      continue: token,
    };
    const results = await getBackendSrv().post<SearchResults>(
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

/** A hit of a kind's search as a starred row, which carries the kind and links to the page of the object. */
function toRow(kind: StarredAppKind, item: ResultItem): StarredRow {
  // The generated type leaves the values unchecked
  const fields: Record<string, unknown> = item.fields ?? {};
  const { name } = item.resource;
  return {
    kind: kind.searchKind,
    uid: name,
    name: typeof fields.title === 'string' && fields.title ? fields.title : name,
    // A kind's route leaves out the app sub path, which a link carries
    url: locationUtil.assureBaseUrl(kind.getRoute(name)),
    description: typeof fields.description === 'string' ? fields.description : '',
    location: typeof fields.folder === 'string' ? fields.folder : '',
  };
}

/** The starred objects of a kind that the user may read, as rows. Rejects when the kind's search fails. */
async function searchStarredRows(kind: StarredAppKind, names: string[]): Promise<StarredRow[]> {
  const url = await resolveSearchURL(kind);
  if (!url) {
    return [];
  }
  // A request names no more objects than a page holds, so it stays small however many are starred: the server
  // refuses a body over 1 MiB. The requests succeed or fail together: part of a kind's stars would read as all
  // of them
  const batches = await Promise.all(chunk(names, MAX_SEARCH_LIMIT).map((batch) => searchNames(url, batch)));
  return batches.flat().map((item) => toRow(kind, item));
}

// An endpoint of the search client, not of the stars client: a request that is still out holds back every
// invalidation in the client it belongs to, and a star toggle must not wait for a plugin's API
const kindSearchAPI = searchAPI.enhanceEndpoints({ addTagTypes: [STARRED_APP_SEARCH_TAG] }).injectEndpoints({
  endpoints: (build) => ({
    /**
     * Starred objects of app kinds as rows, each kind through its own search endpoint, in no order. A kind whose
     * API is unavailable (plugin not installed, apiserver down, search opted out of) yields nothing: its stars go
     * unshown rather than failing the list around them.
     */
    searchStarredAppKinds: build.query<StarredRow[], StarredNames[]>({
      providesTags: [STARRED_APP_SEARCH_TAG],
      queryFn: async (starred) => {
        const rows = await Promise.all(
          starred.map(async ({ kind: searchKind, names }) => {
            const kind = getStarredAppKinds().find((candidate) => candidate.searchKind === searchKind);
            if (!kind) {
              return [];
            }
            try {
              return await searchStarredRows(kind, names);
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
          })
        );
        return { data: rows.flat() };
      },
    }),
  }),
});

/** Re-searches the starred rows of app kinds, for a view that refreshes on its own schedule. */
export const refetchStarredAppKinds = () => kindSearchAPI.util.invalidateTags([STARRED_APP_SEARCH_TAG]);

/**
 * Re-searches the starred rows of app kinds when one of `names` is starred as an object of one. A write to an
 * unstarred object changes no row, so the search is spared.
 */
export const refetchStarredAppKindsFor =
  (names: string[]): ThunkResult<void> =>
  (dispatch, getState) => {
    const { data } = collectionsAPIv1alpha1.endpoints.listStars.select({ fieldSelector: userStarsFieldSelector() })(
      getState()
    );
    if (starsHoldName(data, getStarredAppKinds(), names)) {
      dispatch(refetchStarredAppKinds());
    }
  };

export const { useSearchStarredAppKindsQuery } = kindSearchAPI;
