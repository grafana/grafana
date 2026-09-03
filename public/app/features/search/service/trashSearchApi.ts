import { getBackendSrv } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import {
  DASHBOARD_API_GROUP,
  dashboardAPIVersionResolver,
} from 'app/features/dashboard/api/DashboardAPIVersionResolver';

/**
 * Client for `POST .../dashboards/trash`, the per-kind deleted-items endpoint mounted by
 * pkg/services/apiserver/searchroutes.
 *
 * Hand-written rather than generated, for the same reason as the notebook search client:
 * the envelope's schema names collide with the legacy dashboard search schemas once the
 * spec processor strips k8s name prefixes. These types mirror the TrashQuery/TrashResults
 * pair in pkg/apis/search/v0alpha1/types.go and have to be kept in step with it.
 *
 * Only the subset the server accepts is modelled. A trash document carries a fixed, small
 * set of fields, so there is no labelSelector and no faceting here.
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

interface TextPredicate {
  value: string;
  fields?: string[];
}

interface FilterPredicate {
  field: string;
  operator: 'In' | 'NotIn';
  values: string[];
}

/** Exactly one property may be set; the set one names the node's type. */
export interface WhereNode {
  and?: WhereNode[];
  text?: TextPredicate;
  filter?: FilterPredicate;
}

export interface SortField {
  field: string;
  direction?: 'asc' | 'desc';
}

/**
 * The request body, minus the envelope's apiVersion/kind, which the caller cannot get wrong
 * because this module adds them.
 *
 * The server decodes with DisallowUnknownFields, so anything not declared here is a 400.
 * Never spread UI state into this.
 */
export interface TrashQuery {
  where?: WhereNode;
  sort?: SortField[];
  fields?: string[];
  limit?: number;
  continue?: string;
}

interface ResourceRef {
  group: string;
  resource: string;
  kind: string;
  name: string;
}

export interface TrashItem {
  resource: ResourceRef;
  /** Only present when the query had a text predicate. */
  score?: number;
  /** The requested fields' values. Absent fields are omitted, so read defensively. */
  fields?: Record<string, unknown>;
}

interface TrashResults {
  metadata: {
    continue?: string;
    totalHits: number;
    totalHitsRelation: 'eq' | 'lte';
  };
  items: TrashItem[];
}

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
