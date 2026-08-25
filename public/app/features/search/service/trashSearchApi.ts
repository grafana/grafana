import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getBackendSrv } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';

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

/** The version the Recently deleted UI talks to. Matches the rest of the deleted-dashboard code. */
const DASHBOARD_API_VERSION = 'v1beta1';

/** The only fields a trash document carries. Anything else is rejected with 422. */
export const TRASH_FIELD_TITLE = 'title';
export const TRASH_FIELD_FOLDER = 'folder';
export const TRASH_FIELD_DELETED_BY = 'deleted_by';
export const TRASH_FIELD_DELETION_TIME = 'deletion_time';
export const TRASH_FIELD_DELETED_RV = 'deleted_rv';

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

export interface TrashResults {
  metadata: {
    continue?: string;
    totalHits: number;
    totalHitsRelation: 'eq' | 'lte';
  };
  items: TrashItem[];
}

/** Fetches one page of deleted dashboards. */
export function fetchTrashPage(query: TrashQuery): Promise<TrashResults> {
  const url = `${getAPIBaseURL(DASHBOARD_API_GROUP, DASHBOARD_API_VERSION)}/dashboards/trash`;
  return getBackendSrv().post<TrashResults>(url, {
    apiVersion: SEARCH_API_VERSION,
    kind: TRASH_QUERY_KIND,
    ...query,
  });
}
