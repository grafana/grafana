import { type FolderRow } from './hooks/useMigrationData';
import { type SortKey, compareFolders } from './sorting';

export interface FolderNode {
  row: FolderRow;
  children: FolderNode[];
  /** Resources in this folder and every folder beneath it. Used for ranking only. */
  totalCount: number;
  /**
   * Whether this folder itself matches the search (always true without one).
   * A folder can be on screen only as the path to a match, or because an
   * ancestor's title matched; select-all leaves those alone.
   */
  matches: boolean;
}

/**
 * Nests rows under their parent. A row whose parent isn't in `rows` (a parent
 * the user can't see, or one filtered out) becomes a root. A cyclic parent
 * reference would leave its rows unreachable from any root, so the leftovers are
 * promoted to roots instead of being dropped.
 */
export function buildFolderTree(rows: FolderRow[]): FolderNode[] {
  const uids = new Set(rows.map((row) => row.uid));
  const childrenOf = new Map<string, FolderRow[]>();
  const roots: FolderRow[] = [];
  for (const row of rows) {
    if (row.parentUid && row.parentUid !== row.uid && uids.has(row.parentUid)) {
      const siblings = childrenOf.get(row.parentUid);
      if (siblings) {
        siblings.push(row);
      } else {
        childrenOf.set(row.parentUid, [row]);
      }
    } else {
      roots.push(row);
    }
  }

  const visited = new Set<string>();
  const build = (row: FolderRow): FolderNode => {
    visited.add(row.uid);
    const children = (childrenOf.get(row.uid) ?? []).filter((child) => !visited.has(child.uid)).map(build);
    const totalCount = children.reduce((sum, child) => sum + child.totalCount, row.resourceCount);
    return { row, children, totalCount, matches: true };
  };

  const nodes = roots.map(build);
  for (const row of rows) {
    if (!visited.has(row.uid)) {
      nodes.push(build(row));
    }
  }
  return nodes;
}

/**
 * Keeps the nodes that match `query`, plus the ancestors needed to reach a match.
 * A folder whose own title matches keeps its whole subtree on screen so the user
 * can see what sits under it.
 */
export function filterFolderTree(nodes: FolderNode[], query: string): FolderNode[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return nodes;
  }

  const titleMatches = (row: FolderRow) => row.title.toLowerCase().includes(q);
  const resourceMatches = (row: FolderRow) => row.directResources.some((r) => r.title.toLowerCase().includes(q));
  const selfMatches = (row: FolderRow) => titleMatches(row) || resourceMatches(row);

  // Keeps a whole subtree, marking only the folders that match themselves.
  const keepSubtree = (node: FolderNode): FolderNode => ({
    ...node,
    children: node.children.map(keepSubtree),
    matches: selfMatches(node.row),
  });

  const filterNode = (node: FolderNode): FolderNode | undefined => {
    if (titleMatches(node.row)) {
      return keepSubtree(node);
    }
    const children = node.children.map(filterNode).filter((child): child is FolderNode => child !== undefined);
    const matches = resourceMatches(node.row);
    if (!matches && children.length === 0) {
      return undefined;
    }
    return { ...node, children, matches };
  };

  return nodes.map(filterNode).filter((node): node is FolderNode => node !== undefined);
}

/** Sorts every level of the tree. Folders rank by their whole subtree's resource count. */
export function sortFolderTree(nodes: FolderNode[], key: SortKey): FolderNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortFolderTree(node.children, key) }))
    .sort((a, b) =>
      compareFolders(
        { title: a.row.title, resourceCount: a.totalCount },
        { title: b.row.title, resourceCount: b.totalCount },
        key
      )
    );
}

/**
 * UIDs of every selectable folder in the tree: those that hold resources and
 * match the search themselves. This is what select-all acts on.
 */
export function selectableUids(nodes: FolderNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.matches && node.row.resourceCount > 0 ? [node.row.uid] : []),
    ...selectableUids(node.children),
  ]);
}
