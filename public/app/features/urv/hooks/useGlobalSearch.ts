import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import {
  FIELD,
  FOLDER_GROUP_RESOURCE,
  MANAGER_FIELDS,
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
  isUnknownManagerFieldError,
  toRequestBody,
} from '../api/globalSearchApi';

import { type PlaceScope } from './usePlaceScope';
import {
  NO_FOLDER,
  ROOT_LEVEL,
  type UrvSort,
  type UrvState,
  type UrvUpdated,
  folderUID,
  updatedSince,
} from './useUrvState';

/** Rows shown per type before "Show more". */
export const GROUP_PREVIEW = 10;
// Fills whole rows of folder cards at 2, 3, 4 or 6 per row.
const FOLDER_PREVIEW = 12;
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

// Remembered for the session, so every visit doesn't start with a failed search.
let serverHasManagerFields = true;

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
  /** Only the folders directly in the current place, not the ones nested below them. */
  childrenOnly: boolean;
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
  provisioned: boolean;
  sort: UrvSort;
  grouped: boolean;
  managerFields: boolean;
}

function toFilters(input: SearchInput): GlobalSearchFilters {
  const uid = folderUID(input.folder);
  const isRoot = input.folder === ROOT_LEVEL;
  return {
    text: input.text,
    // Root level is only what sits directly at the root, so no subfolders there.
    folders: isRoot ? [''] : uid ? [uid] : undefined,
    includeSubfolders: !isRoot,
    noFolder: input.folder === NO_FOLDER,
    tags: input.tags,
    names: input.names,
    owners: input.owners,
    updatedSince: updatedSince(input.updated),
    provisioned: input.provisioned,
  };
}

const EMPTY_COUNTS: SearchCounts = { total: 0, relation: 'eq', types: [], tags: [], skippedTypes: [] };

export function useGlobalSearch(state: UrvState, scope: PlaceScope) {
  const [debouncedQuery, setDebouncedQuery] = useState(state.query);
  useDebounce(() => setDebouncedQuery(state.query), 300, [state.query]);

  const grouped = !state.type && state.group === 'type';
  const [managerFields, setManagerFields] = useState(serverHasManagerFields);
  const input: SearchInput = {
    text: debouncedQuery,
    type: state.type,
    scopeTypes: scope.types,
    names: scope.names,
    folder: state.folder,
    tags: state.tags,
    owners: state.owners,
    updated: state.updated,
    provisioned: state.provisioned && managerFields,
    sort: state.sort,
    grouped,
    managerFields,
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

    const itemQuery = (overrides: Partial<GlobalSearchFilters>, limit: number): SearchQuery => ({
      where: buildWhere({ ...filters, ...overrides }),
      sort: sortFields(parsed.sort),
      fields: parsed.managerFields ? [...ITEM_FIELDS, ...MANAGER_FIELDS] : ITEM_FIELDS,
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

    const runGroup = async (type: string, query: SearchQuery, childrenOnly = false): Promise<ResultGroup> => {
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
        childrenOnly,
      };
    };

    // While browsing a folder, its subfolders show one level like a file browser.
    // Searching or filtering looks at every level.
    const browsing =
      !parsed.text.trim() &&
      !parsed.tags.length &&
      !parsed.owners.length &&
      !parsed.updated &&
      !parsed.provisioned &&
      !parsed.names;
    const browsedFolder = browsing ? folderUID(parsed.folder) : undefined;
    const childrenOnly = Boolean(browsedFolder);
    const runFolderSection = () =>
      runGroup(
        FOLDER_GROUP_RESOURCE,
        itemQuery(
          {
            types: [FOLDER_GROUP_RESOURCE],
            ...(browsedFolder && { folders: [browsedFolder], includeSubfolders: false }),
          },
          FOLDER_PREVIEW
        ),
        childrenOnly
      );

    // Folders lead like in a file browser, then a mixed list of everything else.
    const runUngrouped = () => {
      const scopeTypes = parsed.scopeTypes;
      const wantFolders = !scopeTypes || scopeTypes.includes(FOLDER_GROUP_RESOURCE);
      const otherTypes = scopeTypes?.filter((type) => type !== FOLDER_GROUP_RESOURCE);
      return Promise.all([
        wantFolders && runFolderSection(),
        otherTypes?.length !== 0 &&
          runGroup('', itemQuery({ types: otherTypes, excludeTypes: [FOLDER_GROUP_RESOURCE] }, PAGE_SIZE)),
      ]).then((groups) => groups.filter((group): group is ResultGroup => Boolean(group)));
    };

    const groupsPromise = parsed.grouped
      ? // One preview per type, folders first, then in the order the facet ranks them.
        countsPromise.then((res) =>
          Promise.all(
            foldersFirst(res.facets?.[FIELD.groupResource] ?? [])
              .filter((term) => term.count > 0)
              .map((term) =>
                term.value === FOLDER_GROUP_RESOURCE
                  ? runFolderSection()
                  : runGroup(term.value, itemQuery({ types: [term.value] }, GROUP_PREVIEW))
              )
          )
        )
      : parsed.type
        ? runGroup(parsed.type, itemQuery({ types: [parsed.type] }, PAGE_SIZE)).then((group) => [group])
        : runUngrouped();

    let retrying = false;
    groupsPromise
      .then((next) => isCurrent() && setGroups(next))
      .catch((err) => {
        if (!isCurrent()) {
          return;
        }
        if (parsed.managerFields && isUnknownManagerFieldError(err)) {
          serverHasManagerFields = false;
          retrying = true;
          setManagerFields(false);
          return;
        }
        setError(err);
      })
      .finally(() => isCurrent() && !retrying && setIsLoading(false));
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
    /** False when the search server doesn't know the manager fields, so rows carry no provisioning info. */
    managerFieldsSupported: managerFields,
  };
}

function foldersFirst(terms: FacetTerm[]): FacetTerm[] {
  return [
    ...terms.filter((term) => term.value === FOLDER_GROUP_RESOURCE),
    ...terms.filter((term) => term.value !== FOLDER_GROUP_RESOURCE),
  ];
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
  const selectedUID = folderUID(selectedFolder);
  if (selectedUID) {
    wanted.add(selectedUID);
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
