import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import { FIELD, FOLDER_GROUP_RESOURCE, type ResultItem, buildWhere, globalSearch } from '../api/globalSearchApi';

import { useTeamFolders } from './useTeamFolders';

export interface FolderNode {
  uid: string;
  title: string;
  parentUid: string;
}

const MAX_FOLDERS_PER_LEVEL = 200;
const MAX_FILTER_MATCHES = 30;

export function toFolderNode(item: ResultItem): FolderNode {
  const title = item.fields?.[FIELD.title];
  const parent = item.fields?.[FIELD.folder];
  return {
    uid: item.resource.name,
    title: typeof title === 'string' && title ? title : item.resource.name,
    parentUid: typeof parent === 'string' ? parent : '',
  };
}

async function listFolders(parentUid: string): Promise<FolderNode[]> {
  const res = await globalSearch({
    where: buildWhere({ types: [FOLDER_GROUP_RESOURCE], folders: [parentUid] }),
    sort: [{ field: FIELD.title, direction: 'asc' }],
    fields: [FIELD.title, FIELD.folder],
    limit: MAX_FOLDERS_PER_LEVEL,
  });
  return res.items.map(toFolderNode);
}

async function countWhere(where: ReturnType<typeof buildWhere>): Promise<number> {
  const res = await globalSearch({ where, limit: 1 });
  return res.metadata.totalHits;
}

/** Everything below a folder, and whether any of it is a folder, so leaf folders can skip the expand button. */
export async function countUnder(uid: string): Promise<{ count: number; hasSubfolders: boolean }> {
  const res = await globalSearch({
    where: buildWhere({ folders: [uid], includeSubfolders: true }),
    facets: [FIELD.groupResource],
    limit: 1,
  });
  const folders = res.facets?.[FIELD.groupResource]?.find((term) => term.value === FOLDER_GROUP_RESOURCE);
  return { count: res.metadata.totalHits, hasSubfolders: (folders?.count ?? 0) > 0 };
}

/** Folder tree, filter and counts for the sidebar, all from global search. */
export function useFolderSidebar(filter: string) {
  // Keyed by parent uid, with '' for the root.
  const [children, setChildren] = useState<Record<string, FolderNode[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [hasSubfolders, setHasSubfolders] = useState<Record<string, boolean>>({});
  const [totals, setTotals] = useState<{ all?: number; root?: number; noFolder?: number; folders?: number }>({});
  const [matches, setMatches] = useState<FolderNode[]>();
  const [parentTitles, setParentTitles] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const requestedCounts = useRef(new Set<string>());

  const load = useCallback(async (parentUid: string) => {
    try {
      const nodes = await listFolders(parentUid);
      setChildren((prev) => ({ ...prev, [parentUid]: nodes }));
    } catch {
      setChildren((prev) => ({ ...prev, [parentUid]: [] }));
    }
  }, []);

  useEffect(() => {
    requestedCounts.current = new Set();
    setChildren({});
    setCounts({});
    setHasSubfolders({});
    load('');
    Promise.all([
      countWhere(undefined),
      countWhere(buildWhere({ folders: [''] })),
      countWhere(buildWhere({ noFolder: true })),
      countWhere(buildWhere({ types: [FOLDER_GROUP_RESOURCE] })),
    ])
      .then(([all, root, noFolder, folders]) => setTotals({ all, root, noFolder, folders }))
      .catch(() => setTotals({}));
  }, [load, reloadKey]);

  // Reopen what was expanded after a reload.
  useEffect(() => {
    expanded.forEach((uid) => {
      if (!children[uid]) {
        load(uid);
      }
    });
  }, [children, expanded, load]);

  const toggle = useCallback((uid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  }, []);

  const [debouncedFilter, setDebouncedFilter] = useState(filter);
  useDebounce(() => setDebouncedFilter(filter.trim()), 250, [filter]);

  useEffect(() => {
    if (!debouncedFilter) {
      setMatches(undefined);
      return;
    }
    let cancelled = false;
    globalSearch({
      where: buildWhere({ types: [FOLDER_GROUP_RESOURCE], text: debouncedFilter }),
      fields: [FIELD.title, FIELD.folder],
      limit: MAX_FILTER_MATCHES,
    })
      .then((res) => !cancelled && setMatches(res.items.map(toFolderNode)))
      .catch(() => !cancelled && setMatches([]));
    return () => {
      cancelled = true;
    };
  }, [debouncedFilter, reloadKey]);

  // Filter matches can sit anywhere, so show their parent's title to tell them apart.
  const parentKey = [...new Set((matches ?? []).map((node) => node.parentUid).filter(Boolean))]
    .filter((uid) => !parentTitles[uid])
    .sort()
    .join(',');
  useEffect(() => {
    if (!parentKey) {
      return;
    }
    const names = parentKey.split(',');
    globalSearch({
      where: buildWhere({ types: [FOLDER_GROUP_RESOURCE], names }),
      fields: [FIELD.title],
      limit: names.length,
    })
      .then((res) =>
        setParentTitles((prev) => ({
          ...prev,
          ...Object.fromEntries(res.items.map((i) => [i.resource.name, toFolderNode(i).title])),
        }))
      )
      .catch(() => {});
  }, [parentKey]);

  const team = useTeamFolders();
  const teamFolderUids = useMemo(() => new Set(team.folders.map((node) => node.uid)), [team.folders]);
  const teamFolders = useMemo(() => {
    const needle = debouncedFilter.toLowerCase();
    return needle ? team.folders.filter((node) => node.title.toLowerCase().includes(needle)) : team.folders;
  }, [team.folders, debouncedFilter]);

  // Global search can't facet on folders, so each visible folder gets its own count.
  const visible = [
    ...teamFolders,
    ...(matches ?? [...(children[''] ?? []), ...[...expanded].flatMap((uid) => children[uid] ?? [])]),
  ];
  const countKey = visible
    .map((node) => node.uid)
    .filter((uid) => !requestedCounts.current.has(uid))
    .sort()
    .join(',');
  useEffect(() => {
    if (!countKey) {
      return;
    }
    const uids = countKey.split(',');
    uids.forEach((uid) => requestedCounts.current.add(uid));
    uids.forEach((uid) => {
      countUnder(uid)
        .then(({ count, hasSubfolders }) => {
          setCounts((prev) => ({ ...prev, [uid]: count }));
          setHasSubfolders((prev) => ({ ...prev, [uid]: hasSubfolders }));
        })
        .catch(() => requestedCounts.current.delete(uid));
    });
  }, [countKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return {
    children,
    expanded,
    toggle,
    counts,
    hasSubfolders,
    totals,
    matches,
    parentTitles,
    teamFolders,
    teamFolderUids,
    teamFoldersError: team.error,
    reload,
  };
}
