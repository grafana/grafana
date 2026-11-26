import { type TrashQuery, type TrashResults } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getBackendSrv } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import {
  DASHBOARD_API_GROUP,
  dashboardAPIVersionResolver,
} from 'app/features/dashboard/api/DashboardAPIVersionResolver';

/**
 * Client for `POST .../dashboards/trash`, the per-kind deleted-items endpoint mounted by
 * pkg/services/apiserver/searchroutes. The request and result types are the generated ones. The
 * request is made here rather than through the generated endpoint: that one names v0alpha1, and
 * this asks which version the server serves.
 */

const SEARCH_API_VERSION = 'search.grafana.app/v0alpha1';
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

/**
 * Fetches one page of deleted dashboards. The envelope's apiVersion and kind are set here, so the
 * caller cannot get them wrong.
 *
 * The server decodes with DisallowUnknownFields, so anything the query type does not declare is a
 * 400. Never spread UI state into the query.
 */
export async function fetchTrashPage(query: TrashQuery): Promise<TrashResults> {
  // The endpoint is mounted on every served version of the kind, so ask which one this server
  // serves rather than naming a version that it may have dropped. Resolution is cached.
  const { v1 } = await dashboardAPIVersionResolver.resolve();
  const url = `${getAPIBaseURL(DASHBOARD_API_GROUP, v1)}/dashboards/trash`;
  return getBackendSrv().post<TrashResults>(
    url,
    {
      ...query,
      apiVersion: SEARCH_API_VERSION,
      kind: TRASH_QUERY_KIND,
    },
    // The caller renders its own message for a failure, in the page where the results would
    // have been. A global toast on top of that would say the same thing twice, or contradict
    // the empty list the page settles on.
    { showErrorAlert: false }
  );
}
