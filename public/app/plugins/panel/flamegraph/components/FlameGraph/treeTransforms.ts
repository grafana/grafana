import { groupBy } from 'lodash';

import { LevelItem } from './dataTransform';

type DataInterface = {
  getValue: (indexes: number[]) => number;
  getLabel: (index: number) => string;
};

export function mergeSubtrees(roots: LevelItem[], data: DataInterface): LevelItem[][] {
  const levels: LevelItem[][] = [];

  const stack: Array<{ parent: undefined | LevelItem; items: LevelItem[]; level: number }> = [
    { parent: undefined, items: roots, level: 0 },
  ];

  while (stack.length) {
    const args = stack.shift()!;

    const newItem: LevelItem = {
      itemIndexes: args.items.flatMap((i) => i.itemIndexes),
      children: [],
      start: 0, // will change later
    };

    levels[args.level] = levels[args.level] || [];
    levels[args.level].push(newItem);

    if (args.parent) {
      newItem.parents = [args.parent];
      const prevSiblingVal = args.parent.children.reduce((acc, child) => {
        return acc + data.getValue(child.itemIndexes);
      }, 0);
      newItem.start = args.parent.start + prevSiblingVal;
      args.parent.children!.push(newItem);
    }

    const children = args.items.flatMap((i) => i.children);
    const childrenGroups = groupBy(children, (c) => data.getLabel(c.itemIndexes[0]));
    for (const g of Object.values(childrenGroups)) {
      stack.push({ parent: newItem, items: g, level: args.level + 1 });
    }
  }

  return levels;
}
