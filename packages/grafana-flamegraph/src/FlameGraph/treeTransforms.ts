import { groupBy } from 'lodash';

import { LevelItem } from './dataTransform';

type DataInterface = {
  getLabel: (index: number) => string;
};

// Merge parent subtree of the roots for the callers tree in the sandwich view of the flame graph.
export function mergeParentSubtrees(roots: LevelItem[], data: DataInterface): LevelItem[][] {
  const newRoots = getParentSubtrees(roots);
  return mergeSubtrees(newRoots, data, 'parents');
}

// Returns a subtrees per root that will have the parents resized to the same value as the root. When doing callers
// tree we need to keep proper sizes of the parents, before we merge them, so we correctly attribute to the parents
// only the value it contributed to the root.
// So if we have something like:
// [0/////////////]
// [1//][4/////][6]
// [2]  [5/////]
// [6]  [6/][8/]
// [7]
// Taking all the node with '6' will create:
// [0][0/]
// [1][4/]
// [2][5/][0]
// [6][6/][6]
// Which we can later merge.
function getParentSubtrees(roots: LevelItem[]) {
  return roots.map((r) => {
    if (!r.parents?.length) {
      return r;
    }

    const newRoot = {
      ...r,
      children: [],
    };
    const stack: Array<{ child: undefined | LevelItem; parent: LevelItem }> = [
      { child: newRoot, parent: r.parents[0] },
    ];

    while (stack.length) {
      const args = stack.shift()!;
      const newNode = {
        ...args.parent,
        children: args.child ? [args.child] : [],
        parents: [],
      };

      if (args.child) {
        newNode.value = args.child.value;
        args.child.parents = [newNode];
      }

      if (args.parent.parents?.length) {
        stack.push({ child: newNode, parent: args.parent.parents[0] });
      }
    }
    return newRoot;
  });
}

// Merge subtrees into a single tree. Returns an array of levels for easy rendering. It assumes roots are mergeable,
// meaning they represent the same unit of work (same label). Then we walk the tree in a specified direction,
// merging nodes with the same label and same parent/child into single bigger node. This copies the tree (and all nodes)
// as we are creating new merged nodes and modifying the parents/children.
export function mergeSubtrees(
  roots: LevelItem[],
  data: DataInterface,
  direction: 'parents' | 'children' = 'children'
): LevelItem[][] {
  const oppositeDirection = direction === 'parents' ? 'children' : 'parents';
  const levels: LevelItem[][] = [];

  // Loop instead of recursion to be sure we don't blow stack size limit and save some memory. Each stack item is
  // basically a list of arrays you would pass to each level of recursion.
  const stack: Array<{ previous: undefined | LevelItem; items: LevelItem[]; level: number }> = [
    { previous: undefined, items: roots, level: 0 },
  ];

  while (stack.length) {
    const args = stack.shift()!;
    const indexes = args.items.flatMap((i) => i.itemIndexes);
    const newItem: LevelItem = {
      // We use the items value instead of value from the data frame, cause we could have changed it in the process
      value: args.items.reduce((acc, i) => acc + i.value, 0),
      itemIndexes: indexes,
      // these will change later
      children: [],
      parents: [],
      start: 0,
    };

    levels[args.level] = levels[args.level] || [];
    levels[args.level].push(newItem);

    if (args.previous) {
      // Not the first level, so we need to make sure we update previous items to keep the child/parent relationships
      // and compute correct new start offset for the item.
      newItem[oppositeDirection] = [args.previous];
      const prevSiblingsVal =
        args.previous[direction]?.reduce((acc, node) => {
          return acc + node.value;
        }, 0) || 0;
      newItem.start = args.previous.start + prevSiblingsVal;
      args.previous[direction]!.push(newItem);
    }

    const nextItems = args.items.flatMap((i) => i[direction] || []);
    // Group by label which for now is the only identifier by which we decide if node represents the same unit of work.
    const nextGroups = groupBy(nextItems, (c) => data.getLabel(c.itemIndexes[0]));
    for (const g of Object.values(nextGroups)) {
      stack.push({ previous: newItem, items: g, level: args.level + 1 });
    }
  }

  // Reverse the levels if we are doing callers tree, so we return levels in the correct order.
  if (direction === 'parents') {
    levels.reverse();
  }

  return levels;
}
