import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import { ManagerKind } from 'app/features/apiserver/types';

/**
 * Client for `POST .../namespaces/{namespace}/global/search`, the search that spans resource types.
 *
 * Hand-written for the same reason as the trash client: the envelope's schema names collide with
 * the legacy search schemas in generated clients. These types mirror SearchQuery and
 * GlobalSearchResults in pkg/apis/search/v0alpha1/types.go.
 */

const SEARCH_GROUP = 'search.grafana.app';
const SEARCH_VERSION = 'v0alpha1';
const SEARCH_API_VERSION = `${SEARCH_GROUP}/${SEARCH_VERSION}`;

/** Fields every document in the global index carries. */
export const FIELD = {
  title: 'title',
  description: 'description',
  tags: 'tags',
  folder: 'folder',
  folderTree: 'folderTree',
  groupResource: 'groupResource',
  created: 'created',
  updated: 'updated',
  createdBy: 'createdBy',
  name: 'name',
  // Not in the global index field list upstream yet; this POC allows them in the API layer.
  managerKind: 'manager.kind',
  managerId: 'manager.id',
} as const;

export const MANAGER_FIELDS: string[] = [FIELD.managerKind, FIELD.managerId];

export const FOLDER_GROUP_RESOURCE = 'folder.grafana.app/folders';

interface TextPredicate {
  value: string;
  fields?: string[];
}

interface FilterPredicate {
  field: string;
  operator: 'In' | 'NotIn' | 'All';
  values: string[];
}

interface RangePredicate {
  field: string;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
}

/** Exactly one property may be set. The server accepts one leaf, or one `and` of leaves. */
export interface WhereNode {
  and?: WhereNode[];
  text?: TextPredicate;
  filter?: FilterPredicate;
  range?: RangePredicate;
}

export interface SortField {
  field: string;
  direction?: 'asc' | 'desc';
}

/** The server rejects unknown keys, so never spread UI state into this. */
export interface SearchQuery {
  where?: WhereNode;
  sort?: SortField[];
  fields?: string[];
  facets?: string[];
  facetLimit?: number;
  limit?: number;
  continue?: string;
}

export interface ResourceRef {
  group: string;
  resource: string;
  kind: string;
  name: string;
}

export interface ResultItem {
  resource: ResourceRef;
  score?: number;
  fields?: Record<string, unknown>;
}

export interface FacetTerm {
  value: string;
  count: number;
}

export interface GlobalSearchResults {
  metadata: {
    continue?: string;
    totalHits: number;
    totalHitsRelation: 'eq' | 'lte' | 'unknown';
    skippedTypes?: string[];
  };
  items: ResultItem[];
  facets?: Record<string, FacetTerm[]>;
}

export interface GlobalSearchFilters {
  text?: string;
  /** `{group}/{resource}` values. */
  types?: string[];
  excludeTypes?: string[];
  folders?: string[];
  includeSubfolders?: boolean;
  /** Things at the root. Root folders are left out, since they're places rather than content. */
  noFolder?: boolean;
  /** Every tag must be present. */
  tags?: string[];
  names?: string[];
  /** `createdBy` values, like `user:<uid>`. */
  owners?: string[];
  /** Epoch milliseconds. */
  updatedSince?: number;
  /** Only things synced from a Git repository. */
  provisioned?: boolean;
}

export function buildWhere(filters: GlobalSearchFilters): WhereNode | undefined {
  const leaves: WhereNode[] = [];
  const text = filters.text?.trim();
  if (text) {
    // Without fields the server only searches titles.
    leaves.push({ text: { value: text, fields: [FIELD.title, FIELD.description] } });
  }
  if (filters.types?.length) {
    leaves.push({ filter: { field: FIELD.groupResource, operator: 'In', values: filters.types } });
  }
  const excluded = new Set(filters.excludeTypes);
  if (filters.noFolder) {
    excluded.add(FOLDER_GROUP_RESOURCE);
  }
  if (excluded.size) {
    leaves.push({ filter: { field: FIELD.groupResource, operator: 'NotIn', values: [...excluded] } });
  }
  if (filters.noFolder) {
    leaves.push({ filter: { field: FIELD.folder, operator: 'In', values: [''] } });
  } else if (filters.folders?.length) {
    // folderTree matches what is below the folders, but never the folders themselves.
    const field = filters.includeSubfolders ? FIELD.folderTree : FIELD.folder;
    leaves.push({ filter: { field, operator: 'In', values: filters.folders } });
  }
  if (filters.tags?.length) {
    leaves.push({ filter: { field: FIELD.tags, operator: 'All', values: filters.tags } });
  }
  if (filters.names?.length) {
    leaves.push({ filter: { field: FIELD.name, operator: 'In', values: filters.names } });
  }
  if (filters.owners?.length) {
    leaves.push({ filter: { field: FIELD.createdBy, operator: 'In', values: filters.owners } });
  }
  if (filters.updatedSince !== undefined) {
    leaves.push({ range: { field: FIELD.updated, gte: filters.updatedSince } });
  }
  if (filters.provisioned) {
    leaves.push({ filter: { field: FIELD.managerKind, operator: 'In', values: [ManagerKind.Repo] } });
  }
  return leaves.length ? { and: leaves } : undefined;
}

export function globalSearchURL(): string {
  return `${getAPIBaseURL(SEARCH_GROUP, SEARCH_VERSION)}/global/search`;
}

/** The full body sent to the server, kept separate so the page can show it for debugging. */
export function toRequestBody(query: SearchQuery) {
  return { apiVersion: SEARCH_API_VERSION, kind: 'SearchQuery', ...query };
}

export async function globalSearch(query: SearchQuery): Promise<GlobalSearchResults> {
  const results = await getBackendSrv().post<GlobalSearchResults>(globalSearchURL(), toRequestBody(query), {
    showErrorAlert: false,
  });
  return { ...results, items: results.items ?? [] };
}

interface StatusCause {
  reason?: string;
  message?: string;
}

/**
 * Search servers on an older release reject the manager fields instead of skipping them.
 * Cloud runs search on its own release, so the page can get there first.
 */
export function isUnknownManagerFieldError(err: unknown): boolean {
  if (!isFetchError(err) || err.status !== 422) {
    return false;
  }
  const causes: unknown = err.data?.details?.causes;
  if (!Array.isArray(causes)) {
    return false;
  }
  return causes.some(
    (cause: StatusCause) =>
      cause.reason === 'FieldValueInvalid' &&
      MANAGER_FIELDS.some((name) => cause.message === `Invalid value: "${name}": unknown field`)
  );
}

export function groupResourceOf(ref: Pick<ResourceRef, 'group' | 'resource'>): string {
  return `${ref.group}/${ref.resource}`;
}
