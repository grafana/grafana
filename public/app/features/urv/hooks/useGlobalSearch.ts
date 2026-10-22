import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import {
  FIELD,
  FOLDER_GROUP_RESOURCE,
  type FacetTerm,
  type GlobalSearchFilters,
  type GlobalSearchResults,
  type ResourceRef,
  type ResultItem,
  type SearchQuery,
  type SortField,
  buildWhere,
  globalSearch,
  groupResourceOf,
  toRequestBody,
} from '../api/globalSearchApi';

import { type PlaceScope } from './usePlaceScope';
import { NO_FOLDER, type UrvSort, type UrvState, type UrvUpdated, updatedSince } from './useUrvState';

/** Rows shown per type before "Show more". */
export const GROUP_PREVIEW = 10;
export const PAGE_SIZE = 50;
const FACET_LIMIT = 50;
const ITEM_FIELDS = [
  FIELD.title,
  FIELD.folder,
  FIELD.tags,
  FIELD.created,
  FIELD.updated,
  FIELD.createdBy,
  FIELD.description,
];

function sortFields(sort: UrvSort): SortField[] | undefined {
  switch (sort) {
    case 'updated':
      return [{ field: FIELD.updated, direction: 'desc' }];
    case 'created':
      return [{ field: FIELD.created, direction: 'desc' }];
    case 'title':
      return [{ field: FIELD.title, direction: 'asc' }];
    case 'relevance':
      return undefined;
  }
}

export interface ResultGroup {
  /** `group/resource`, or empty for a list that mixes types. */
  type: string;
  items: ResultItem[];
  total: number;
  relation: GlobalSearchResults['metadata']['totalHitsRelation'];
  continue?: string;
  isLoadingMore: boolean;
}

export interface SearchCounts {
  total: number;
  relation: GlobalSearchResults['metadata']['totalHitsRelation'];
  types: FacetTerm[];
  tags: FacetTerm[];
  skippedTypes: string[];
}

export interface UrvDebugInfo {
  countsRequest?: object;
  countsMetadata?: GlobalSearchResults['metadata'];
  itemRequests: Record<string, object>;
  folderTitlesRequest?: object;
}

/** Plain values only, so it can be the effect key. */
interface SearchInput {
  text: string;
  type?: string;
  scopeTypes?: string[];
  names?: string[];
  folder?: string;
  tags: string[];
  owners: string[];
  updated?: UrvUpdated;
  sort: UrvSort;
  grouped: boolean;
}

function toFilters(input: SearchInput): GlobalSearchFilters {
  return {
    text: input.text,
    folders: input.folder && input.folder !== NO_FOLDER ? [input.folder] : undefined,
    includeSubfolders: true,
    noFolder: input.folder === NO_FOLDER,
    tags: input.tags,
    names: input.names,
    owners: input.owners,
    updatedSince: updatedSince(input.updated),
  };
}

const EMPTY_COUNTS: SearchCounts = { total: 0, relation: 'eq', types: [], tags: [], skippedTypes: [] };

export function useGlobalSearch(state: UrvState, scope: PlaceScope) {
  const [debouncedQuery, setDebouncedQuery] = useState(state.query);
  useDebounce(() => setDebouncedQuery(state.query), 300, [state.query]);

  const grouped = !state.type && state.group === 'type';
  const input: SearchInput = {
    text: debouncedQuery,
    type: state.type,
    scopeTypes: scope.types,
    names: scope.names,
    folder: state.folder,
    tags: state.tags,
    owners: state.owners,
    updated: state.updated,
    sort: state.sort,
    grouped,
  };
  const inputKey = JSON.stringify(input);

  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [counts, setCounts] = useState<SearchCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [debug, setDebug] = useState<UrvDebugInfo>({ itemRequests: {} });
  const [reloadKey, setReloadKey] = useState(0);

  // Bumped on every new search so late answers to an older one are dropped.
  const generation = useRef(0);
  const groupQueries = useRef<Record<string, SearchQuery>>({});

  useEffect(() => {
    if (scope.isLoading) {
      return;
    }
    const gen = ++generation.current;
    const parsed: SearchInput = JSON.parse(inputKey);
    const filters = toFilters(parsed);
    const isCurrent = () => gen === generation.current;

    groupQueries.current = {};
    setIsLoading(true);
    setError(undefined);

    if (parsed.names?.length === 0) {
      setGroups([]);
      setCounts(EMPTY_COUNTS);
      setIsLoading(false);
      return;
    }

    const itemQuery = (types: string[] | undefined, limit: number): SearchQuery => ({
      where: buildWhere({ ...filters, types }),
      sort: sortFields(parsed.sort),
      fields: ITEM_FIELDS,
      limit,
    });

    // Counts ignore the selected tab so every tab shows what picking it would give.
    const countsQuery: SearchQuery = {
      where: buildWhere({ ...filters, types: parsed.scopeTypes }),
      facets: [FIELD.groupResource, FIELD.tags],
      facetLimit: FACET_LIMIT,
      limit: 1,
    };
    setDebug({ countsRequest: toRequestBody(countsQuery), itemRequests: {} });

    const countsPromise = globalSearch(countsQuery).then((res) => {
      if (isCurrent()) {
        setCounts({
          total: res.metadata.totalHits,
          relation: res.metadata.totalHitsRelation,
          types: res.facets?.[FIELD.groupResource] ?? [],
          tags: res.facets?.[FIELD.tags] ?? [],
          skippedTypes: res.metadata.skippedTypes ?? [],
        });
        setDebug((prev) => ({ ...prev, countsMetadata: res.metadata }));
      }
      return res;
    });

    const runGroup = async (type: string, query: SearchQuery): Promise<ResultGroup> => {
      groupQueries.current[type] = query;
      setDebug((prev) => ({ ...prev, itemRequests: { ...prev.itemRequests, [type || 'all']: toRequestBody(query) } }));
      const res = await globalSearch(query);
      return {
        type,
        items: res.items,
        total: res.metadata.totalHits,
        relation: res.metadata.totalHitsRelation,
        continue: res.metadata.continue,
        isLoadingMore: false,
      };
    };

    const groupsPromise = parsed.grouped
      ? // One preview per type, in the order the facet ranks them.
        countsPromise.then((res) =>
          Promise.all(
            (res.facets?.[FIELD.groupResource] ?? [])
              .filter((term) => term.count > 0)
              .map((term) => runGroup(term.value, itemQuery([term.value], GROUP_PREVIEW)))
          )
        )
      : runGroup(parsed.type ?? '', itemQuery(parsed.type ? [parsed.type] : parsed.scopeTypes, PAGE_SIZE)).then(
          (group) => [group]
        );

    groupsPromise
      .then((next) => isCurrent() && setGroups(next))
      .catch((err) => isCurrent() && setError(err))
      .finally(() => isCurrent() && setIsLoading(false));
    // The list still works without counts.
    countsPromise.catch(() => {});
  }, [inputKey, reloadKey, scope.isLoading]);

  const patchGroup = useCallback((type: string, patch: (group: ResultGroup) => ResultGroup) => {
    setGroups((prev) => prev.map((group) => (group.type === type ? patch(group) : group)));
  }, []);

  const loadMore = useCallback(
    async (type: string) => {
      const group = groups.find((g) => g.type === type);
      const base = groupQueries.current[type];
      if (!group?.continue || !base) {
        return;
      }
      const gen = generation.current;
      const query: SearchQuery = { ...base, limit: PAGE_SIZE, continue: group.continue };
      patchGroup(type, (g) => ({ ...g, isLoadingMore: true }));
      setDebug((prev) => ({ ...prev, itemRequests: { ...prev.itemRequests, [type || 'all']: toRequestBody(query) } }));
      try {
        const res = await globalSearch(query);
        if (gen === generation.current) {
          patchGroup(type, (g) => ({
            ...g,
            items: [...g.items, ...res.items],
            total: res.metadata.totalHits,
            continue: res.metadata.continue,
            isLoadingMore: false,
          }));
        }
      } catch (err) {
        if (gen === generation.current) {
          setError(err);
          patchGroup(type, (g) => ({ ...g, isLoadingMore: false }));
        }
      }
    },
    [groups, patchGroup]
  );

  // The index catches up a moment after a write, so a refresh right away can still show the old state.
  const refresh = useCallback((delayMs = 0) => {
    setTimeout(() => setReloadKey((key) => key + 1), delayMs);
  }, []);

  /** Drop a deleted item right away, before the refresh confirms it. */
  const removeItem = useCallback((ref: ResourceRef) => {
    const type = groupResourceOf(ref);
    setGroups((prev) =>
      prev.map((group) => {
        const items = group.items.filter((item) => !sameRef(item.resource, ref));
        return items.length === group.items.length ? group : { ...group, items, total: Math.max(0, group.total - 1) };
      })
    );
    setCounts((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
      types: prev.types.map((term) => (term.value === type ? { ...term, count: Math.max(0, term.count - 1) } : term)),
    }));
  }, []);

  const allItems = groups.flatMap((group) => group.items);
  const folderTitles = useFolderTitles(allItems, state.folder, setDebug);

  return {
    groups,
    counts,
    isLoading: isLoading || scope.isLoading,
    error,
    loadMore,
    refresh,
    removeItem,
    folderTitles,
    debug,
  };
}

function sameRef(a: ResourceRef, b: ResourceRef) {
  return a.group === b.group && a.resource === b.resource && a.name === b.name;
}

/** Results only carry folder names, so look the titles up with one more global search. */
function useFolderTitles(
  items: ResultItem[],
  selectedFolder: string | undefined,
  setDebug: (update: (prev: UrvDebugInfo) => UrvDebugInfo) => void
): Record<string, string> {
  const [titles, setTitles] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());

  const wanted = new Set<string>();
  for (const item of items) {
    const folder = item.fields?.[FIELD.folder];
    if (typeof folder === 'string' && folder) {
      wanted.add(folder);
    }
  }
  if (selectedFolder && selectedFolder !== NO_FOLDER) {
    wanted.add(selectedFolder);
  }
  const missing = [...wanted].filter((uid) => !requested.current.has(uid)).sort();
  const missingKey = missing.join(',');

  useEffect(() => {
    if (!missingKey) {
      return;
    }
    const names = missingKey.split(',');
    names.forEach((uid) => requested.current.add(uid));
    const query: SearchQuery = {
      where: buildWhere({ types: [FOLDER_GROUP_RESOURCE], names }),
      fields: [FIELD.title],
      limit: names.length,
    };
    setDebug((prev) => ({ ...prev, folderTitlesRequest: toRequestBody(query) }));
    globalSearch(query)
      .then((res) => {
        const found: Record<string, string> = {};
        for (const item of res.items) {
          const title = item.fields?.[FIELD.title];
          found[item.resource.name] = typeof title === 'string' ? title : item.resource.name;
        }
        setTitles((prev) => ({ ...prev, ...found }));
      })
      .catch(() => {
        // Let a later render try these again.
        names.forEach((uid) => requested.current.delete(uid));
      });
  }, [missingKey, setDebug]);

  return titles;
}
