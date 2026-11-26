import { api } from './baseAPI';
export const addTagTypes = ['Search'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      listGlobalSearchV0Alpha1: build.query<ListGlobalSearchV0Alpha1ApiResponse, ListGlobalSearchV0Alpha1ApiArg>({
        query: (queryArg) => ({ url: `/global/search`, method: 'POST', body: queryArg.globalSearchQuery }),
        providesTags: ['Search'],
      }),
      listGlobalHybridSearchV0Alpha1: build.query<
        ListGlobalHybridSearchV0Alpha1ApiResponse,
        ListGlobalHybridSearchV0Alpha1ApiArg
      >({
        query: (queryArg) => ({ url: `/global/search/hybrid`, method: 'POST', body: queryArg.hybridSearchQuery }),
        providesTags: ['Search'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedAPI };
export type ListGlobalSearchV0Alpha1ApiResponse = /** status 200 A GlobalSearchResults envelope. */ GlobalSearchResults;
export type ListGlobalSearchV0Alpha1ApiArg = {
  /** A SearchQuery describing what to match, sort and return. */
  globalSearchQuery: GlobalSearchQuery;
};
export type ListGlobalHybridSearchV0Alpha1ApiResponse =
  /** status 200 A HybridSearchResults envelope. */ HybridSearchResults;
export type ListGlobalHybridSearchV0Alpha1ApiArg = {
  /** A HybridSearchQuery with a nonempty resources list. */
  hybridSearchQuery: HybridSearchQuery;
};
export type FacetTerm = {
  count: number;
  value: string;
};
export type FolderPathItem = {
  detached?: boolean;
  name: string;
  title?: string;
};
export type Unstructured = {
  [key: string]: any;
};
export type ResourceRef = {
  group: string;
  kind: string;
  name: string;
  resource: string;
};
export type GlobalResultItem = {
  /** Access says, for each verb the query's access names, whether the caller may do it to this item. A verb that could not be checked is left out, so a missing verb means unknown rather than no. It reflects permissions only: an item can still refuse an edit, for example when it is provisioned (see the manager fields). */
  access?: {
    [key: string]: boolean;
  };
  /** Fields holds the JSON values for the requested (or default) fields. Array-typed fields are returned as JSON arrays. Absent fields are omitted. */
  fields?: Unstructured;
  resource: ResourceRef;
  /** Score is present only when a text query was evaluated. A pointer so a real score of 0 is still distinguishable from "no text query" (absent). */
  score?: number;
};
export type GlobalResultsMetadata = {
  continue?: string;
  /** SkippedTypes lists the types, as {group}/{resource}, that the search left out, so the results are incomplete. A type is left out when the calling service may not search it on the user's behalf, or when this deployment does not check its results against the user. Both are deployment problems. */
  skippedTypes?: string[];
  /** TotalHits counts the resources matching the query. Always read it together with TotalHitsRelation. When the relation is "unknown", this is a zero placeholder that must not be interpreted as a count. */
  totalHits: number;
  /** TotalHitsRelation is "eq" when TotalHits is exact and "lte" when it is an upper bound. "unknown" means no count is available and TotalHits must be ignored. */
  totalHitsRelation: string;
};
export type GlobalSearchResults = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Facets holds term counts per requested facet field. Counts are computed over a bounded sample window, so they are best-effort/approximate. */
  facets?: {
    [key: string]: FacetTerm[];
  };
  /** FolderPaths holds the path of each folder the items are in, keyed by the folder's name as items return it in the folder field. Only items that return the folder field are covered, and the root folder has no path. Paths are display data: they are left out when they cannot be found. */
  folderPaths?: {
    [key: string]: FolderPathItem[];
  };
  items: GlobalResultItem[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata: GlobalResultsMetadata;
};
export type LabelSelectorRequirement = {
  /** key is the label key that the selector applies to. */
  key: string;
  /** operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist. */
  operator: string;
  /** values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch. */
  values?: string[];
};
export type LabelSelector = {
  /** matchExpressions is a list of label selector requirements. The requirements are ANDed. */
  matchExpressions?: LabelSelectorRequirement[];
  /** matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed. */
  matchLabels?: {
    [key: string]: string;
  };
};
export type SortField = {
  direction?: string;
  field: string;
};
export type ExistsPredicate = {
  field: string;
};
export type FilterPredicate = {
  field: string;
  /** Operator is "In", "NotIn" or "All" in v1. "In" matches any of the values, "NotIn" excludes all of them, and "All" requires the field to hold every value, which only a field holding a list of values can do. */
  operator: string;
  values: string[];
};
export type RangePredicate = {
  field: string;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
};
export type RegexPredicate = {
  field: string;
  /** Negate inverts the match: the field must not match the pattern. */
  negate?: boolean;
  pattern: string;
};
export type TextPredicate = {
  /** Boost is a future per-leaf score multiplier. Setting it is rejected in v1. */
  boost?: number;
  fields?: string[];
  value: string;
};
export type WhereNode = {
  /** Combinators. */
  and?: WhereNode[];
  exists?: ExistsPredicate;
  filter?: FilterPredicate;
  not?: WhereNode;
  or?: WhereNode[];
  range?: RangePredicate;
  regex?: RegexPredicate;
  /** Leaves. */
  text?: TextPredicate;
};
export type GlobalSearchQuery = {
  /** Access names verbs to check for each returned item against the caller: update, delete and set_permissions. Each item then says, in its access, whether the caller may do them. Only the returned page is checked. */
  access?: string[];
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Continue is an opaque pagination token from a previous page. */
  continue?: string;
  /** FacetLimit caps the number of terms returned per facet. It applies to every entry in Facets. Zero uses the server default; values above the server cap are clamped. */
  facetLimit?: number;
  facets?: string[];
  fields?: string[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** LabelSelector filters on metadata.labels, ANDed with Where. */
  labelSelector?: LabelSelector;
  /** Limit is the page size. Zero uses the default; values above the maximum are clamped. */
  limit?: number;
  sort?: SortField[];
  /** Where is the search predicate tree. Omitting it matches everything the endpoint searches: all resources of the kind, or of every type the global search covers (subject to labelSelector and per-item authz). */
  where?: WhereNode;
};
export type HybridSearchChunk = {
  content: string;
  /** Subresource identifies a chunk, for example panel/5. Empty means the whole resource, or a synthesized chunk for a lexical-only hit. */
  subresource: string;
};
export type HybridSearchManagedBy = {
  id: string;
  kind: string;
};
export type HybridSearchResultItem = {
  /** Chunks contains matching text, best first. A lexical-only hit has a synthesized chunk containing the resource's title. */
  chunks: HybridSearchChunk[];
  /** Folder is the containing folder's UID. Empty and "general" denote the root folder. */
  folder: string;
  /** FolderTitle is best-effort display data and can be absent. */
  folderTitle?: string;
  /** ManagedBy is absent for unmanaged resources or when lookup fails. */
  managedBy?: HybridSearchManagedBy;
  resource: ResourceRef;
  /** Score is opaque: higher scores rank first, but scores are meaningful only for ordering within this response. Do not compare scores across queries or treat them as probabilities or distances. */
  score: number;
  /** Tags from the lexical index. Omitted when unavailable. */
  tags?: string[];
  title: string;
};
export type HybridSearchResults = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  items: HybridSearchResultItem[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
};
export type HybridSearchFilter = {
  /** Field is uid or folder for all resources. A single dashboard resource type additionally supports datasource_uid and language (promql, logql, traceql or sql). Searches across multiple types support only uid and folder. */
  field: string;
  /** Values must contain at least one value. Values containing '*' are rejected. An empty folder value matches resources in the root folder. */
  values: string[];
};
export type HybridSearchResource = {
  group: string;
  resource: string;
};
export type HybridSearchQuery = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Filters are ANDed together. Each field may appear once, with at most 1000 values across all filters. Embedding fields supply text only and do not make additional fields available for filtering. */
  filters?: HybridSearchFilter[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** Limit is the maximum number of results across all requested resource types. Zero uses the default of 50, values above 200 are clamped, and negative values are rejected. */
  limit?: number;
  /** MinRelevance is lowest, low, medium, high or highest. Empty keeps every result. Filtering is best-effort: no results are dropped when reranking is unavailable or fails. It cannot be combined with SkipRerank. */
  minRelevance?: string;
  /** Query supplies the lexical query and, unless SemanticQuery is set, the text embedded for semantic search. Required, with a maximum of 1000 bytes. */
  query: string;
  /** Resources selects unique group/resource pairs for global hybrid search. On Grafana's HTTP route, omitted or empty uses configured defaults, if any. Per-resource routes reject it. */
  resources?: HybridSearchResource[];
  /** SemanticQuery supplies optional richer phrasing for semantic search. When provided, it must not be whitespace and must fit within 1000 bytes. */
  semanticQuery?: string;
  /** SkipRerank skips reranking even when a reranker is configured. Multiple resource types are interleaved in request order, preserving each type's ranking. */
  skipRerank?: boolean;
};
export const {
  useListGlobalSearchV0Alpha1Query,
  useLazyListGlobalSearchV0Alpha1Query,
  useListGlobalHybridSearchV0Alpha1Query,
  useLazyListGlobalHybridSearchV0Alpha1Query,
} = injectedRtkApi;
