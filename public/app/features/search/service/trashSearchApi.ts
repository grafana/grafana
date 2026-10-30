import { getBackendSrv } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import {
  SEARCH_API_VERSION,
  type SearchQueryBody,
  type SearchResultItem,
  type SearchResults,
} from 'app/features/apiserver/search';
import {
  DASHBOARD_API_GROUP,
  dashboardAPIVersionResolver,
} from 'app/features/dashboard/api/DashboardAPIVersionResolver';

/**
 * Client for `POST .../dashboards/trash`, the per-kind deleted-items endpoint mounted by
 * pkg/services/apiserver/searchroutes. It takes the shared search.grafana.app query, under
 * the TrashQuery kind, and answers in the shared result shape.
 */

const TRASH_QUERY_KIND = 'TrashQuery';

/**
 * The fields a trash document carries that this code reads. Anything outside the trash field
 * set is rejected with 422. `deleted_rv` is also always returned, since the server appends it,
 * but nothing here consumes it: restore re-fetches the object rather than submitting a version.
 */
export const TRASH_FIELD_TITLE = 'title';
export const TRASH_FIELD_FOLDER = 'folder';
export const TRASH_FIELD_TAGS = 'tags';
export const TRASH_FIELD_DELETED_BY = 'deleted_by';
export const TRASH_FIELD_DELETION_TIME = 'deletion_time';

export type TrashItem = SearchResultItem;

/**
 * The request body, minus the envelope's apiVersion/kind, which the caller cannot get wrong
 * because this module adds them. A trash document carries a fixed, small set of fields, so
 * there is no faceting here.
 */
export type TrashQuery = Pick<SearchQueryBody, 'where' | 'sort' | 'fields' | 'limit' | 'continue'>;

type TrashResults = Omit<SearchResults, 'facets'>;

/** Fetches one page of deleted dashboards. */
export async function fetchTrashPage(query: TrashQuery): Promise<TrashResults> {
  // The endpoint is mounted on every served version of the kind, so ask which one this server
  // serves rather than naming a version that it may have dropped. Resolution is cached.
  const { v1 } = await dashboardAPIVersionResolver.resolve();
  const url = `${getAPIBaseURL(DASHBOARD_API_GROUP, v1)}/dashboards/trash`;
  return getBackendSrv().post<TrashResults>(
    url,
    {
      apiVersion: SEARCH_API_VERSION,
      kind: TRASH_QUERY_KIND,
      ...query,
    },
    // The caller renders its own message for a failure, in the page where the results would
    // have been. A global toast on top of that would say the same thing twice, or contradict
    // the empty list the page settles on.
    { showErrorAlert: false }
  );
}
