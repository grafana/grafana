import { type FolderMeta, buildTree, pruneByTitle } from './useK8sFoldersWithRules';

function meta(entries: FolderMeta[]): Map<string, FolderMeta> {
  return new Map(entries.map((e) => [e.uid, e]));
}

describe('buildTree', () => {
  it('nests folders under their parents and preserves the backend facet order', () => {
    // c (root, intermediate) > [a-child, z-child]; b (root). directCounts is
    // insertion-ordered by the facet's count-descending terms.
    const folders = meta([
      { uid: 'z', title: 'zulu', parentUid: 'c' },
      { uid: 'c', title: 'charlie' },
      { uid: 'a', title: 'alpha', parentUid: 'c' },
      { uid: 'b', title: 'bravo' },
    ]);
    // Facet order: b(3) is highest count but its effective rank competes with
    // charlie's best child a(rank 1). a < b in facet order, so charlie sorts first.
    const counts = new Map<string, number>([
      ['a', 5],
      ['b', 4],
      ['z', 1],
    ]);

    const roots = buildTree(folders, counts);

    // charlie ranks by its best child (a, rank 0); bravo is rank 1 → charlie, bravo.
    expect(roots.map((n) => n.uid)).toEqual(['c', 'b']);
    const charlie = roots.find((n) => n.uid === 'c')!;
    // children ordered by facet rank: a (0) before z (2).
    expect(charlie.children.map((n) => n.uid)).toEqual(['a', 'z']);
    // intermediate folder with no direct rules still appears, count 0
    expect(charlie.directRuleCount).toBe(0);
    expect(charlie.children.find((n) => n.uid === 'a')!.directRuleCount).toBe(5);
  });

  it('treats a folder whose parent is absent as a root', () => {
    const roots = buildTree(meta([{ uid: 'orphan', title: 'orphan', parentUid: 'missing' }]), new Map());
    expect(roots.map((n) => n.uid)).toEqual(['orphan']);
  });
});

describe('pruneByTitle', () => {
  const tree = buildTree(
    meta([
      { uid: 'root', title: 'root' },
      { uid: 'child', title: 'payments', parentUid: 'root' },
      { uid: 'other', title: 'logging' },
    ]),
    new Map()
  );

  it('returns the tree unchanged with no filter', () => {
    expect(pruneByTitle(tree, undefined)).toBe(tree);
    expect(pruneByTitle(tree, '   ')).toBe(tree);
  });

  it('keeps an ancestor when a nested folder matches', () => {
    const pruned = pruneByTitle(tree, 'pay');
    expect(pruned.map((n) => n.uid)).toEqual(['root']);
    expect(pruned[0].children.map((n) => n.uid)).toEqual(['child']);
  });

  it('drops branches with no match', () => {
    const pruned = pruneByTitle(tree, 'logging');
    expect(pruned.map((n) => n.uid)).toEqual(['other']);
  });
});
