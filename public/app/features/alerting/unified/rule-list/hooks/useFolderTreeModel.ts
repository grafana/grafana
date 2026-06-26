import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type GetSearchRulesApiArg,
  useLazyGetSearchRulesQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useLazySearchDashboardsAndFoldersQuery } from 'app/api/clients/dashboard/v0alpha1';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { groups } from '../../utils/navigation';
import { type GroupDisplayMode, type GroupRowStyle, groupRulesByGroup, useGroupDisplayParams } from '../groupDisplay';

import { type RuleSearchHit, mapRuleHitToDTO } from './searchRuleToPromRule';
import { type GrafanaRuleWithOrigin } from './useFilteredRulesIterator';
import { type K8sRuleFilter } from './useK8sFolderRules';

/**
 * The folders API uses the `general` UID as the sentinel for "list root-level folders" (server-side
 * it maps to an empty parent). It is NOT an alerting concept — kept here as a named constant so the
 * rest of the alerting code never references a literal "general" folder.
 */
export const ROOT_FOLDER = 'general';

const RULE_PAGE_SIZE = 24;
const CHILDREN_PAGE_SIZE = 24;

export interface FolderNode {
  uid: string;
  title: string;
  parentUid?: string;
}

interface ChildrenState {
  items: FolderNode[];
  /** Server offset for the next page (count of items fetched so far). */
  offset: number;
  /** Total number of child folders reported by the search backend. */
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  loaded: boolean;
  error?: unknown;
}

interface RulesState {
  rules: GrafanaRuleWithOrigin[];
  continueToken?: string;
  hasMore: boolean;
  isLoading: boolean;
  loaded: boolean;
  error?: unknown;
}

export type TreeRow =
  | { kind: 'folder'; key: string; uid: string; title: string; level: number; isOpen: boolean }
  | {
      kind: 'group-header';
      key: string;
      level: number;
      folderUid: string;
      groupName: string;
      href: string;
      style: GroupRowStyle;
      isOpen: boolean;
    }
  | {
      kind: 'group-label';
      key: string;
      level: number;
      groupName: string;
      href: string;
      count: number;
      interval?: string;
    }
  | { kind: 'rule'; key: string; rule: GrafanaRuleWithOrigin; level: number; groupAsPill?: boolean }
  | { kind: 'rules-loading'; key: string; level: number }
  | { kind: 'rules-error'; key: string; level: number }
  | { kind: 'rules-loadmore'; key: string; level: number; folderUid: string; isLoading: boolean }
  | { kind: 'children-loadmore'; key: string; level: number; folderUid: string; isLoading: boolean }
  | { kind: 'empty'; key: string; level: number };

interface UseFolderTreeModelArgs {
  groupFilter?: string;
  ruleFilter?: K8sRuleFilter;
  /** When provided (flat search mode), these are the root rows instead of the folders API root listing. */
  rootFolders?: FolderNode[];
}

export interface FolderTreeModel {
  rows: TreeRow[];
  toggleFolder: (uid: string) => void;
  toggleGroup: (folderUid: string, groupName: string) => void;
  loadMoreRules: (uid: string) => void;
  loadMoreChildren: (uid: string) => void;
  isLoadingRoot: boolean;
  rootError: unknown;
  isEmpty: boolean;
}

function groupStateKey(folderUid: string, groupName: string): string {
  return `${folderUid}|${groupName}`;
}

export function useFolderTreeModel({ groupFilter, ruleFilter, rootFolders }: UseFolderTreeModelArgs): FolderTreeModel {
  const [fetchChildren] = useLazySearchDashboardsAndFoldersQuery();
  const [fetchRules] = useLazyGetSearchRulesQuery();

  const { mode, rowStyle } = useGroupDisplayParams();
  // `rows` and `merged` bucket a folder's rules by group, so request them group-contiguous.
  const groupedLayout = mode === 'rows' || mode === 'merged';

  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [childrenByUid, setChildrenByUid] = useState<Record<string, ChildrenState>>({});
  const [rulesByUid, setRulesByUid] = useState<Record<string, RulesState>>({});

  // Filters define a fresh tree; reset everything when they change.
  const filterKey = useMemo(() => JSON.stringify({ groupFilter, ruleFilter }), [groupFilter, ruleFilter]);
  useEffect(() => {
    setOpenFolders(new Set());
    setOpenGroups(new Set());
    setChildrenByUid({});
    setRulesByUid({});
  }, [filterKey]);

  const loadChildren = useCallback(
    (uid: string, offset: number) => {
      setChildrenByUid((prev) => ({
        ...prev,
        [uid]: { ...(prev[uid] ?? emptyChildrenState()), isLoading: true, error: undefined },
      }));
      // `folder=ROOT_FOLDER` lists top-level folders; `folder=<uid>` lists direct (non-recursive)
      // children. A stable server sort is required so offset paging stays consistent across pages.
      fetchChildren({ type: 'folder', folder: uid, sort: 'title', limit: CHILDREN_PAGE_SIZE, offset })
        .unwrap()
        .then((res) => {
          // `type=folder` already restricts hits to folders, so no resource filtering is needed.
          const hits = res.hits ?? [];
          const items: FolderNode[] = hits.map((hit) => ({
            uid: hit.name,
            title: hit.title,
            parentUid: hit.folder || undefined,
          }));
          setChildrenByUid((prev) => {
            const existing = offset > 0 ? (prev[uid]?.items ?? []) : [];
            const nextItems = existing.concat(items);
            const nextOffset = offset + hits.length;
            const total = res.totalHits ?? nextOffset;
            return {
              ...prev,
              [uid]: {
                items: nextItems,
                offset: nextOffset,
                total,
                // An empty page means we've reached the end regardless of the reported total,
                // which also prevents the exhaust loop from spinning if the offset can't advance.
                hasMore: hits.length > 0 && nextOffset < total,
                isLoading: false,
                loaded: true,
              },
            };
          });
        })
        .catch((error) => {
          setChildrenByUid((prev) => ({
            ...prev,
            [uid]: { ...(prev[uid] ?? emptyChildrenState()), isLoading: false, loaded: true, error },
          }));
        });
    },
    [fetchChildren]
  );

  const loadRules = useCallback(
    (uid: string, token: string | undefined) => {
      setRulesByUid((prev) => ({
        ...prev,
        [uid]: { ...(prev[uid] ?? emptyRulesState()), isLoading: true, error: undefined },
      }));
      const args = {
        ...buildFolderSearchArgs(uid, groupFilter, ruleFilter, groupedLayout),
        limit: String(RULE_PAGE_SIZE),
        continueToken: token,
      };
      fetchRules(args)
        .unwrap()
        .then((res) => {
          const hits: RuleSearchHit[] = res.items ?? [];
          const next = res.metadata?.continue;
          setRulesByUid((prev) => {
            const existing = token ? (prev[uid]?.rules ?? []) : [];
            return {
              ...prev,
              [uid]: {
                rules: existing.concat(hits.map((hit) => mapHit(hit))),
                continueToken: next,
                hasMore: Boolean(next),
                isLoading: false,
                loaded: true,
              },
            };
          });
        })
        .catch((error) => {
          setRulesByUid((prev) => ({
            ...prev,
            [uid]: { ...(prev[uid] ?? emptyRulesState()), isLoading: false, loaded: true, error },
          }));
        });
    },
    [fetchRules, groupFilter, ruleFilter, groupedLayout]
  );

  // Root listing: either the supplied flat-search results or the folders search root children.
  const usingFlatRoot = rootFolders !== undefined;

  const toggleFolder = useCallback((uid: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
        return next;
      }
      next.add(uid);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((folderUid: string, groupName: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      const key = groupStateKey(folderUid, groupName);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      next.add(key);
      return next;
    });
  }, []);

  // Drives lazy loading for the root listing and every open folder: load the first page of child
  // folders, then (once all children are loaded) load that folder's own rules. Further child pages
  // are loaded on demand as the user scrolls (see `loadMoreChildren`), not eagerly here.
  useEffect(() => {
    const targets = usingFlatRoot ? [...openFolders] : [ROOT_FOLDER, ...openFolders];
    for (const uid of targets) {
      const children = childrenByUid[uid];
      if (!children) {
        loadChildren(uid, 0);
        continue;
      }
      // Wait until the child folders are fully loaded before fetching the folder's own rules,
      // which render below them. Remaining pages are pulled in by scroll, so don't block on them.
      if (children.isLoading || (children.hasMore && !children.error)) {
        continue;
      }
      // The root sentinel has no rules of its own.
      if (uid !== ROOT_FOLDER && children.loaded && !rulesByUid[uid]) {
        loadRules(uid, undefined);
      }
    }
  }, [usingFlatRoot, openFolders, childrenByUid, rulesByUid, loadChildren, loadRules]);

  const loadMoreRules = useCallback(
    (uid: string) => {
      const state = rulesByUid[uid];
      if (state?.hasMore && !state.isLoading) {
        loadRules(uid, state.continueToken);
      }
    },
    [rulesByUid, loadRules]
  );

  const loadMoreChildren = useCallback(
    (uid: string) => {
      const state = childrenByUid[uid];
      if (state?.hasMore && !state.isLoading) {
        loadChildren(uid, state.offset);
      }
    },
    [childrenByUid, loadChildren]
  );

  const rootList = useMemo(() => rootFolders ?? childrenByUid[ROOT_FOLDER]?.items ?? [], [rootFolders, childrenByUid]);

  const ctx: BuildContext = useMemo(
    () => ({ openFolders, openGroups, childrenByUid, rulesByUid, mode, rowStyle }),
    [openFolders, openGroups, childrenByUid, rulesByUid, mode, rowStyle]
  );

  const rows = useMemo(() => {
    const built = buildRows(rootList, 0, ctx);
    // Top-level folders paginate on scroll too: append the root's load-more sentinel.
    const rootChildren = usingFlatRoot ? undefined : childrenByUid[ROOT_FOLDER];
    if (rootChildren?.hasMore) {
      built.push({
        kind: 'children-loadmore',
        key: `cm-${ROOT_FOLDER}`,
        level: 0,
        folderUid: ROOT_FOLDER,
        isLoading: rootChildren.isLoading,
      });
    }
    return built;
  }, [rootList, ctx, usingFlatRoot, childrenByUid]);

  const isLoadingRoot = usingFlatRoot ? false : !childrenByUid[ROOT_FOLDER]?.loaded;
  const rootError = usingFlatRoot ? undefined : childrenByUid[ROOT_FOLDER]?.error;
  const isEmpty = !isLoadingRoot && rootList.length === 0;

  return { rows, toggleFolder, toggleGroup, loadMoreRules, loadMoreChildren, isLoadingRoot, rootError, isEmpty };
}

interface BuildContext {
  openFolders: Set<string>;
  openGroups: Set<string>;
  childrenByUid: Record<string, ChildrenState>;
  rulesByUid: Record<string, RulesState>;
  mode: GroupDisplayMode;
  rowStyle: GroupRowStyle;
}

function buildRows(folders: FolderNode[], level: number, ctx: BuildContext): TreeRow[] {
  const { openFolders, childrenByUid, rulesByUid } = ctx;
  const out: TreeRow[] = [];

  for (const folder of folders) {
    const isOpen = openFolders.has(folder.uid);
    out.push({ kind: 'folder', key: `f-${folder.uid}`, uid: folder.uid, title: folder.title, level, isOpen });

    if (!isOpen) {
      continue;
    }

    const children = childrenByUid[folder.uid];
    const rules = rulesByUid[folder.uid];

    // Child folders first, then this folder's own rules (matches the approved layout).
    if (children?.items.length) {
      out.push(...buildRows(children.items, level + 1, ctx));
    }
    // Sentinel that loads the next page of child folders when scrolled into view.
    if (children?.hasMore) {
      out.push({
        kind: 'children-loadmore',
        key: `cm-${folder.uid}`,
        level: level + 1,
        folderUid: folder.uid,
        isLoading: children.isLoading,
      });
    }

    if (rules) {
      emitRules(out, folder.uid, rules.rules, level + 1, ctx);
      if (rules.isLoading && rules.rules.length === 0) {
        out.push({ kind: 'rules-loading', key: `rl-${folder.uid}`, level: level + 1 });
      }
      if (rules.error) {
        out.push({ kind: 'rules-error', key: `re-${folder.uid}`, level: level + 1 });
      }
      if (rules.hasMore) {
        out.push({
          kind: 'rules-loadmore',
          key: `rm-${folder.uid}`,
          level: level + 1,
          folderUid: folder.uid,
          isLoading: rules.isLoading,
        });
      }
    }

    const childrenSettled = Boolean(children?.loaded) && (children?.items.length ?? 0) === 0;
    const rulesSettled = Boolean(rules?.loaded) && (rules?.rules.length ?? 0) === 0 && !rules?.hasMore && !rules?.error;
    const stillLoading = Boolean(children?.isLoading) || Boolean(rules?.isLoading);
    if (childrenSettled && rulesSettled && !stillLoading) {
      out.push({ kind: 'empty', key: `e-${folder.uid}`, level: level + 1 });
    }
  }

  return out;
}

/** Emits a folder's own rules according to the active groupDisplay mode. */
function emitRules(
  out: TreeRow[],
  folderUid: string,
  rules: GrafanaRuleWithOrigin[],
  level: number,
  ctx: BuildContext
): void {
  const { mode, rowStyle, openGroups } = ctx;

  const pushRule = (rule: GrafanaRuleWithOrigin, ruleLevel: number, groupAsPill?: boolean) => {
    out.push({ kind: 'rule', key: `r-${folderUid}-${ruleKey(rule)}`, rule, level: ruleLevel, groupAsPill });
  };

  // `flat` and `pill` keep a single flat list; `pill` shows the group name as a pill on each row.
  if (mode === 'flat' || mode === 'pill') {
    for (const rule of rules) {
      pushRule(rule, level, mode === 'pill');
    }
    return;
  }

  const { groups: buckets, ungrouped } = groupRulesByGroup(rules);

  if (mode === 'rows') {
    for (const { groupName, rules: groupRules } of buckets) {
      const href = groups.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, folderUid, groupName);
      // Inline headers always show their rules; collapsible headers start collapsed.
      const isOpen = rowStyle === 'inline' || openGroups.has(groupStateKey(folderUid, groupName));
      out.push({
        kind: 'group-header',
        key: `g-${folderUid}-${groupName}`,
        level,
        folderUid,
        groupName,
        href,
        style: rowStyle,
        isOpen,
      });
      if (isOpen) {
        for (const rule of groupRules) {
          pushRule(rule, level + 1);
        }
      }
    }
    for (const rule of ungrouped) {
      pushRule(rule, level);
    }
    return;
  }

  // `merged`: a single-rule group collapses to its rule with a pill; multi-rule groups get a quiet,
  // non-collapsible label. Ungrouped rules render with a pill for visual consistency.
  for (const { groupName, rules: groupRules } of buckets) {
    if (groupRules.length === 1) {
      pushRule(groupRules[0], level, true);
      continue;
    }
    const href = groups.detailsPageLink(GRAFANA_RULES_SOURCE_NAME, folderUid, groupName);
    out.push({
      kind: 'group-label',
      key: `gl-${folderUid}-${groupName}`,
      level,
      groupName,
      href,
      count: groupRules.length,
      interval: groupRules[0]?.interval,
    });
    for (const rule of groupRules) {
      pushRule(rule, level + 1);
    }
  }
  for (const rule of ungrouped) {
    pushRule(rule, level, true);
  }
}

function emptyRulesState(): RulesState {
  return { rules: [], hasMore: false, isLoading: false, loaded: false };
}

function emptyChildrenState(): ChildrenState {
  return { items: [], offset: 0, total: 0, hasMore: false, isLoading: false, loaded: false };
}

function ruleKey(ruleWithOrigin: GrafanaRuleWithOrigin): string {
  return `${ruleWithOrigin.groupIdentifier.namespace.uid}-${ruleWithOrigin.groupIdentifier.groupName}-${ruleWithOrigin.rule.uid}`;
}

function mapHit(hit: RuleSearchHit): GrafanaRuleWithOrigin {
  return {
    rule: mapRuleHitToDTO(hit),
    groupIdentifier: {
      namespace: { uid: hit.folder },
      groupName: hit.group ?? '',
      groupOrigin: 'grafana',
    },
    // Folder title isn't needed in the tree (the folder row carries it); the rule row shows location off.
    namespaceName: '',
    origin: 'grafana',
    interval: hit.interval,
  };
}

function buildFolderSearchArgs(
  folderUid: string,
  groupFilter?: string,
  ruleFilter?: K8sRuleFilter,
  sortByGroup = false
): GetSearchRulesApiArg {
  const args: GetSearchRulesApiArg = { folders: folderUid, sort: sortByGroup ? 'group' : 'title' };

  if (groupFilter?.trim()) {
    args.groups = groupFilter.trim();
  }
  if (ruleFilter?.ruleName?.trim()) {
    args.q = ruleFilter.ruleName.trim();
  }
  if (ruleFilter?.ruleType) {
    args.type = ruleFilter.ruleType === PromRuleType.Recording ? 'recordingrule' : 'alertrule';
  }
  if (ruleFilter?.dashboardUid) {
    args.dashboardUid = ruleFilter.dashboardUid;
  }
  if (ruleFilter?.contactPoint) {
    args.receiver = ruleFilter.contactPoint;
  }

  return args;
}
