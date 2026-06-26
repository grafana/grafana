import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type GetSearchRulesApiArg,
  useLazyGetSearchRulesQuery,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useLazyGetFolderChildrenQuery } from 'app/api/clients/folder/v1beta1';
import { PromRuleType } from 'app/types/unified-alerting-dto';

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
const FOLDER_ANNOTATION = 'grafana.app/folder';

export interface FolderNode {
  uid: string;
  title: string;
  parentUid?: string;
}

interface ChildrenState {
  items: FolderNode[];
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
  | { kind: 'rule'; key: string; rule: GrafanaRuleWithOrigin; level: number }
  | { kind: 'rules-loading'; key: string; level: number }
  | { kind: 'rules-error'; key: string; level: number }
  | { kind: 'rules-loadmore'; key: string; level: number; folderUid: string; loadedCount: number; isLoading: boolean }
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
  loadMoreRules: (uid: string) => void;
  isLoadingRoot: boolean;
  rootError: unknown;
  isEmpty: boolean;
}

export function useFolderTreeModel({ groupFilter, ruleFilter, rootFolders }: UseFolderTreeModelArgs): FolderTreeModel {
  const [fetchChildren] = useLazyGetFolderChildrenQuery();
  const [fetchRules] = useLazyGetSearchRulesQuery();

  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [childrenByUid, setChildrenByUid] = useState<Record<string, ChildrenState>>({});
  const [rulesByUid, setRulesByUid] = useState<Record<string, RulesState>>({});

  // Filters define a fresh tree; reset everything when they change.
  const filterKey = useMemo(() => JSON.stringify({ groupFilter, ruleFilter }), [groupFilter, ruleFilter]);
  useEffect(() => {
    setOpenFolders(new Set());
    setChildrenByUid({});
    setRulesByUid({});
  }, [filterKey]);

  const loadChildren = useCallback(
    (uid: string) => {
      setChildrenByUid((prev) => ({ ...prev, [uid]: { items: [], isLoading: true, loaded: false } }));
      fetchChildren({ name: uid })
        .unwrap()
        .then((res) => {
          const items: FolderNode[] = (res.items ?? []).map((f) => ({
            uid: f.metadata?.name ?? '',
            title: f.spec?.title ?? '',
            parentUid: f.metadata?.annotations?.[FOLDER_ANNOTATION] || undefined,
          }));
          setChildrenByUid((prev) => ({ ...prev, [uid]: { items, isLoading: false, loaded: true } }));
        })
        .catch((error) => {
          setChildrenByUid((prev) => ({ ...prev, [uid]: { items: [], isLoading: false, loaded: true, error } }));
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
        ...buildFolderSearchArgs(uid, groupFilter, ruleFilter),
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
    [fetchRules, groupFilter, ruleFilter]
  );

  // Root listing: either the supplied flat-search results or the folders API root children.
  const usingFlatRoot = rootFolders !== undefined;
  useEffect(() => {
    if (!usingFlatRoot && !childrenByUid[ROOT_FOLDER]) {
      loadChildren(ROOT_FOLDER);
    }
  }, [usingFlatRoot, childrenByUid, loadChildren]);

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

  // Fetch a folder's children + first rule page the first time it opens.
  useEffect(() => {
    openFolders.forEach((uid) => {
      if (!childrenByUid[uid]) {
        loadChildren(uid);
      }
      if (!rulesByUid[uid]) {
        loadRules(uid, undefined);
      }
    });
    // childrenByUid/rulesByUid are guarded by presence checks; openFolders drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFolders]);

  const loadMoreRules = useCallback(
    (uid: string) => {
      const state = rulesByUid[uid];
      if (state?.hasMore && !state.isLoading) {
        loadRules(uid, state.continueToken);
      }
    },
    [rulesByUid, loadRules]
  );

  const rootList = useMemo(() => rootFolders ?? childrenByUid[ROOT_FOLDER]?.items ?? [], [rootFolders, childrenByUid]);

  const rows = useMemo(
    () => buildRows(rootList, 0, openFolders, childrenByUid, rulesByUid),
    [rootList, openFolders, childrenByUid, rulesByUid]
  );

  const isLoadingRoot = usingFlatRoot ? false : !childrenByUid[ROOT_FOLDER]?.loaded;
  const rootError = usingFlatRoot ? undefined : childrenByUid[ROOT_FOLDER]?.error;
  const isEmpty = !isLoadingRoot && rootList.length === 0;

  return { rows, toggleFolder, loadMoreRules, isLoadingRoot, rootError, isEmpty };
}

function buildRows(
  folders: FolderNode[],
  level: number,
  openFolders: Set<string>,
  childrenByUid: Record<string, ChildrenState>,
  rulesByUid: Record<string, RulesState>
): TreeRow[] {
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
      out.push(...buildRows(children.items, level + 1, openFolders, childrenByUid, rulesByUid));
    }

    if (rules) {
      for (const rule of rules.rules) {
        out.push({ kind: 'rule', key: `r-${folder.uid}-${ruleKey(rule)}`, rule, level: level + 1 });
      }
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
          loadedCount: rules.rules.length,
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

function emptyRulesState(): RulesState {
  return { rules: [], hasMore: false, isLoading: false, loaded: false };
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
  ruleFilter?: K8sRuleFilter
): GetSearchRulesApiArg {
  const args: GetSearchRulesApiArg = { folders: folderUid, sort: 'title' };

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
