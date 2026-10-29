/**
 * Request and result types of `POST .../{plural}/search`, the per-kind search endpoint
 * pkg/services/apiserver/searchroutes mounts for every served kind whose manifest enables it.
 *
 * Hand-written rather than generated: the endpoint's schemas cannot go through
 * `pnpm generate-apis` today, because the envelope's `SearchResults` collides with the
 * legacy dashboards-search schema of the same name once the spec processor strips k8s
 * name prefixes. These types therefore mirror pkg/apis/search/v0alpha1/types.go by hand
 * and have to be kept in step with it.
 *
 * Only the subset the API accepts in v1 is modelled — a top-level leaf or a single `and`
 * of leaves, with text and filter predicates. `or`/`not`/`range`/`exists` exist in the Go
 * types but are rejected with 422, so representing them here would invite writing a query
 * the server refuses.
 */

export const SEARCH_API_VERSION = 'search.grafana.app/v0alpha1';
export const SEARCH_QUERY_KIND = 'SearchQuery';

/** Matches free text against text-capable fields; defaults to `title` when fields is omitted. */
interface TextPredicate {
  value: string;
  fields?: string[];
}

/**
 * Set membership against one field. `In` matches any of the values, `NotIn` excludes all of
 * them, and `All` requires the field to hold every value, which only a list field can.
 */
interface FilterPredicate {
  field: string;
  operator: 'In' | 'NotIn' | 'All';
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
 * The request body, minus the envelope's apiVersion/kind, which are constant.
 *
 * The server decodes with DisallowUnknownFields, so anything not declared here is a 400.
 * Never spread UI state into this.
 */
export interface SearchQueryBody {
  where?: WhereNode;
  sort?: SortField[];
  fields?: string[];
  facets?: string[];
  facetLimit?: number;
  limit?: number;
  /** The cursor for the next page: absent on the first request, opaque afterwards. */
  continue?: string;
}

interface SearchResourceRef {
  group: string;
  resource: string;
  kind: string;
  name: string;
}

export interface SearchResultItem {
  resource: SearchResourceRef;
  /** Only present when a text predicate was evaluated. */
  score?: number;
  /** The requested fields' values. Absent fields are omitted, so read defensively. */
  fields?: Record<string, unknown>;
}

/** `eq` when totalHits is exact, `lte` when it is an upper bound. */
type TotalHitsRelation = 'eq' | 'lte';

interface SearchResultsMetadata {
  continue?: string;
  totalHits: number;
  totalHitsRelation: TotalHitsRelation;
}

interface FacetTerm {
  value: string;
  count: number;
}

export interface SearchResults {
  metadata: SearchResultsMetadata;
  items: SearchResultItem[];
  facets?: Record<string, FacetTerm[]>;
}
