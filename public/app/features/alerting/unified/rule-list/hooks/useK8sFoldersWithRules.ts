import { useEffect, useMemo, useRef, useState } from 'react';

import { useLazyGetSearchRulesQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useLazyGetFolderParentsQuery } from 'app/api/clients/folder/v1beta1';

const FOLDER_FACET = 'folder';
// Facet terms are top-N by count; folders beyond this cap are not enumerated.
// Backend clamps to maxFacetLimit (20000), so this requests the full set.
const FACET_LIMIT = '20000';

const NO_RANK = Number.MAX_SAFE_INTEGER;

export interface FolderRuleTreeNode {
  uid: string;
  title: string;
  parentUid?: string;
  /** Rules directly in this folder. Zero for an intermediate folder that only contains rule-bearing descendants. */
  directRuleCount: number;
  children: FolderRuleTreeNode[];
}

export interface FolderMeta {
  uid: string;
  title: string;
  parentUid?: string;
}

/**
 * useK8sFoldersWithRules returns the tree of folders that contain Grafana-managed
 * alert or recording rules (directly or in a descendant), ordered alphabetically.
 *
 * It replaces the per-folder `/counts` fan-out with a single faceted `/search`
 * call: `facet=folder` returns folderUID -> rule count for the folders that
 * directly hold rules. Each such folder's ancestry is then resolved via the
 * folder `/parents` endpoint; the union of those chains is exactly the set of
 * folders to display, so the full folder list is never paged.
 */
export function useK8sFoldersWithRules(namespaceFilter?: string) {
  const [triggerSearch] = useLazyGetSearchRulesQuery();
  const [triggerGetParents] = useLazyGetFolderParentsQuery();

  const [rootFolders, setRootFolders] = useState<FolderRuleTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(undefined);
  const didLoad = useRef(false);

  useEffect(() => {
    if (didLoad.current) {
      return;
    }
    didLoad.current = true;

    let cancelled = false;
    setIsLoading(true);
    setError(undefined);

    (async () => {
      // 1. One faceted search → folders that directly contain alert/recording rules.
      const search = await triggerSearch({ facet: FOLDER_FACET, facetLimit: FACET_LIMIT, limit: '0' }).unwrap();
      const directCounts = new Map<string, number>();
      for (const term of search.facets?.[FOLDER_FACET]?.terms ?? []) {
        if (term.term) {
          directCounts.set(term.term, term.count);
        }
      }

      // 2. Resolve each rule-folder's ancestry. `/parents` returns the full
      // root-first chain (folder included) with titles, so the union of all
      // chains gives every folder on a path to rules — no full folder-list scan.
      const folderMeta = new Map<string, FolderMeta>();
      await Promise.all(
        Array.from(directCounts.keys()).map(async (uid) => {
          const parents = await triggerGetParents({ name: uid }).unwrap();
          for (const info of parents.items ?? []) {
            if (info.name && !folderMeta.has(info.name)) {
              folderMeta.set(info.name, { uid: info.name, title: info.title || info.name, parentUid: info.parent });
            }
          }
        })
      );

      if (cancelled) {
        return;
      }
      setRootFolders(buildTree(folderMeta, directCounts));
    })()
      .catch((err) => {
        if (!cancelled) {
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [triggerSearch, triggerGetParents]);

  const folders = useMemo(() => pruneByTitle(rootFolders, namespaceFilter), [rootFolders, namespaceFilter]);

  return { rootFolders: folders, isLoading, error };
}

// buildTree links folders to their parents and returns the roots in the
// backend's facet order (count-descending), so the frontend imposes no ordering
// of its own. A folder whose parent is not in the set (e.g. an ancestor the
// parents chain stopped short of) is treated as a root.
export function buildTree(meta: Map<string, FolderMeta>, directCounts: Map<string, number>): FolderRuleTreeNode[] {
  const nodes = new Map<string, FolderRuleTreeNode>();
  for (const m of meta.values()) {
    nodes.set(m.uid, {
      uid: m.uid,
      title: m.title,
      parentUid: m.parentUid,
      directRuleCount: directCounts.get(m.uid) ?? 0,
      children: [],
    });
  }

  const roots: FolderRuleTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentUid ? nodes.get(node.parentUid) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // directCounts is insertion-ordered by the facet terms, so its key order is
  // the backend's count-descending order.
  const rank = new Map<string, number>();
  let i = 0;
  for (const uid of directCounts.keys()) {
    rank.set(uid, i++);
  }
  orderByRank(roots, rank, new Map());
  return roots;
}

// effectiveRank is a node's own facet rank, or — for an intermediate folder that
// only holds rule-bearing descendants — the best (lowest) rank among them, so a
// parent sorts next to its highest-count child.
function effectiveRank(node: FolderRuleTreeNode, rank: Map<string, number>, memo: Map<string, number>): number {
  const cached = memo.get(node.uid);
  if (cached !== undefined) {
    return cached;
  }
  let best = rank.get(node.uid) ?? NO_RANK;
  for (const child of node.children) {
    best = Math.min(best, effectiveRank(child, rank, memo));
  }
  memo.set(node.uid, best);
  return best;
}

function orderByRank(nodes: FolderRuleTreeNode[], rank: Map<string, number>, memo: Map<string, number>): void {
  nodes.sort((a, b) => {
    const diff = effectiveRank(a, rank, memo) - effectiveRank(b, rank, memo);
    if (diff !== 0) {
      return diff;
    }
    if (a.uid === b.uid) {
      return 0;
    }
    return a.uid < b.uid ? -1 : 1;
  });
  for (const node of nodes) {
    orderByRank(node.children, rank, memo);
  }
}

// pruneByTitle keeps folders whose title matches the filter along with their
// ancestors, so a matching nested folder stays reachable from the top level.
export function pruneByTitle(nodes: FolderRuleTreeNode[], filter?: string): FolderRuleTreeNode[] {
  const needle = filter?.trim().toLowerCase();
  if (!needle) {
    return nodes;
  }
  const prune = (list: FolderRuleTreeNode[]): FolderRuleTreeNode[] => {
    const kept: FolderRuleTreeNode[] = [];
    for (const node of list) {
      const children = prune(node.children);
      if (node.title.toLowerCase().includes(needle) || children.length > 0) {
        kept.push({ ...node, children });
      }
    }
    return kept;
  };
  return prune(nodes);
}
