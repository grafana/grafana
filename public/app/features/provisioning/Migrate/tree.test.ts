import { resourceKindInfos } from '../utils/resourceKinds';

import { type FolderRow } from './hooks/useMigrationData';
import { buildFolderTree, filterFolderTree, selectableUids, sortFolderTree } from './tree';

function row(uid: string, titles: string[] = [], parentUid?: string, title = uid): FolderRow {
  return {
    uid,
    title,
    path: [],
    parentUid,
    resourceCount: titles.length,
    directResources: titles.map((t, i) => ({ uid: `${uid}-${i}`, title: t, kind: resourceKindInfos.dashboard })),
  };
}

// users (no resources of its own) > frank (2) > frank-sub (1), plus root-level misc (3).
const users = row('users');
const frank = row('frank', ['Alpha', 'Beta'], 'users');
const frankSub = row('frank-sub', ['Gamma'], 'frank');
const misc = row('misc', ['One', 'Two', 'Three']);

describe('buildFolderTree', () => {
  it('nests rows under their parent and rolls up subtree counts', () => {
    const tree = buildFolderTree([users, frank, frankSub, misc]);

    expect(tree.map((n) => n.row.uid).sort()).toEqual(['misc', 'users']);
    const usersNode = tree.find((n) => n.row.uid === 'users')!;
    expect(usersNode.children.map((n) => n.row.uid)).toEqual(['frank']);
    expect(usersNode.children[0].children.map((n) => n.row.uid)).toEqual(['frank-sub']);
    expect(usersNode.totalCount).toBe(3);
    expect(usersNode.children[0].totalCount).toBe(3);
  });

  it('treats a row whose parent is not in the set as a root', () => {
    const tree = buildFolderTree([frank, misc]);

    expect(tree.map((n) => n.row.uid).sort()).toEqual(['frank', 'misc']);
  });

  it('keeps rows that sit in a parent cycle reachable instead of dropping them', () => {
    const a = row('a', ['x'], 'b');
    const b = row('b', ['y'], 'a');

    const tree = buildFolderTree([a, b]);

    const uids = tree.flatMap(function walk(n): string[] {
      return [n.row.uid, ...n.children.flatMap(walk)];
    });
    expect(uids.sort()).toEqual(['a', 'b']);
  });
});

describe('filterFolderTree', () => {
  const tree = buildFolderTree([users, frank, frankSub, misc]);

  it('returns the tree untouched for an empty query', () => {
    expect(filterFolderTree(tree, '  ')).toBe(tree);
  });

  it('keeps the ancestors of a match but marks them as not matching', () => {
    const filtered = filterFolderTree(tree, 'gamma');

    expect(filtered.map((n) => n.row.uid)).toEqual(['users']);
    const frankNode = filtered[0].children[0];
    expect(frankNode.matches).toBe(false);
    expect(frankNode.children[0].matches).toBe(true);
    expect(selectableUids(filtered)).toEqual(['frank-sub']);
  });

  it('keeps the whole subtree on screen when a folder title matches', () => {
    const filtered = filterFolderTree(tree, 'frank');

    expect(filtered.map((n) => n.row.uid)).toEqual(['users']);
    expect(filtered[0].children[0].children.map((n) => n.row.uid)).toEqual(['frank-sub']);
    // Both folders match on their titles, so both are selectable.
    expect(selectableUids(filtered).sort()).toEqual(['frank', 'frank-sub']);
  });

  it('shows but does not select subfolders that only ride along with a matching title', () => {
    const filtered = filterFolderTree(tree, 'users');

    expect(filtered[0].children).toHaveLength(1);
    expect(selectableUids(filtered)).toEqual([]);
  });

  it('matches a folder through the title of a resource directly inside it', () => {
    const filtered = filterFolderTree(tree, 'beta');

    expect(selectableUids(filtered)).toEqual(['frank']);
  });
});

describe('selectableUids', () => {
  it('lists every folder that holds resources at any depth, skipping resource-less ones', () => {
    const tree = buildFolderTree([users, frank, frankSub, misc]);

    expect(selectableUids(tree).sort()).toEqual(['frank', 'frank-sub', 'misc']);
  });
});

describe('sortFolderTree', () => {
  it('ranks folders by subtree size at every level', () => {
    const small = row('small', ['a']);
    const tree = buildFolderTree([users, frank, frankSub, small, row('other', ['p', 'q'], 'users')]);

    const sorted = sortFolderTree(tree, 'count-desc');

    // users subtree = 2 + 1 + 2 = 5, small = 1.
    expect(sorted.map((n) => n.row.uid)).toEqual(['users', 'small']);
    // frank subtree = 3, other = 2.
    expect(sorted[0].children.map((n) => n.row.uid)).toEqual(['frank', 'other']);
  });
});
