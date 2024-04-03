import { addRow, DataFrame, Field, FieldType } from '@grafana/data';

import profile from './pyroscope_flamebearer.json';

// START_OFFSET is offset of the bar relative to previous sibling
const START_OFFSET = 0;
// VALUE_OFFSET is value or width of the bar
const VALUE_OFFSET = 1;
// SELF_OFFSET is self value of the bar
const SELF_OFFSET = 2;
// NAME_OFFSET is index into the names array
const NAME_OFFSET = 3;
// ITEM_OFFSET Next bar. Each bar of the profile is represented by 4 number in a flat array.
const ITEM_OFFSET = 4;

type ProfileNode = {
  start: number;
  value: number;
  self: number;
  level: number;
  name: string;
  children: ProfileNode[];
};

function levelsToTree(levels: number[][], names: string[]): ProfileNode | undefined {
  if (levels.length === 0) {
    return undefined;
  }

  const tree: ProfileNode = {
    start: 0,
    value: levels[0][VALUE_OFFSET],
    self: levels[0][SELF_OFFSET],
    level: 0,
    name: names[levels[0][NAME_OFFSET]],
    children: [],
  };

  let parentsStack: ProfileNode[] = [tree];
  let currentLevel = 1;

  // Cycle through each level
  while (true) {
    if (currentLevel >= levels.length) {
      break;
    }

    if (parentsStack.length === 0) {
      throw new Error(
        'We still have levels to go, this should not happen. Something is probably wrong with the flamebearer data'
      );
    }

    const nextParentsStack: ProfileNode[] = [];
    let currentParent = parentsStack.shift()!;
    let itemIndex = 0;
    // cumulative offset as items in flamebearer format have just relative to prev item
    let offset = 0;

    // Cycle through bars in a level
    while (true) {
      if (itemIndex >= levels[currentLevel].length) {
        break;
      }

      const itemStart = levels[currentLevel][itemIndex + START_OFFSET] + offset;
      const itemValue = levels[currentLevel][itemIndex + VALUE_OFFSET];
      const selfValue = levels[currentLevel][itemIndex + SELF_OFFSET];
      const itemEnd = itemStart + itemValue;
      const parentEnd = currentParent.start + currentParent.value;

      if (itemStart >= currentParent.start && itemEnd <= parentEnd) {
        // We have an item that is in the bounds of current parent item, so it should be its child
        const treeItem: ProfileNode = {
          start: itemStart,
          value: itemValue,
          self: selfValue,
          level: currentLevel,
          name: names[levels[currentLevel][itemIndex + NAME_OFFSET]],
          children: [],
        };
        // Add to parent
        currentParent.children.push(treeItem);
        // Add this item as parent for the next level
        nextParentsStack.push(treeItem);
        itemIndex += ITEM_OFFSET;

        // Update offset for next item. This is changing relative offset to absolute one.
        offset = itemEnd;
      } else {
        // We went out of parents bounds so lets move to next parent. We will evaluate the same item again, but
        // we will check if it is a child of the next parent item in line.
        if (parentsStack.length === 0) {
          throw new Error(
            `ParentsStack is empty but there are still items in current level. currentLevel: ${currentLevel}, itemIndex: ${itemIndex}`
          );
        }
        currentParent = parentsStack.shift()!;
        continue;
      }
    }
    parentsStack = nextParentsStack;
    currentLevel++;
  }

  return tree;
}

function treeToNestedSetDataFrame(tree: ProfileNode, unit: string): DataFrame {
  const levelField: Field = { name: 'level', type: FieldType.number, config: {}, values: [] };
  const valueField: Field = { name: 'value', type: FieldType.number, config: { unit }, values: [] };
  const selfField: Field = { name: 'self', type: FieldType.number, config: { unit }, values: [] };
  const labelField: Field = { name: 'label', type: FieldType.string, config: {}, values: [] };

  const frame: DataFrame = {
    name: 'response',
    fields: [levelField, valueField, selfField, labelField],
    length: 0,
    meta: {
      preferredVisualisationType: 'flamegraph',
    },
  };

  if (tree) {
    walkTree(tree, (tree) => {
      addRow(frame, [tree.level, tree.value, tree.self, tree.name]);
    });
  }

  return frame;
}

function walkTree(tree: ProfileNode, fn: (tree: ProfileNode) => void) {
  const stack = [tree];

  while (true) {
    if (stack.length === 0) {
      break;
    }

    const node = stack.shift()!;
    fn(node);

    if (node.children) {
      stack.unshift(...node.children);
    }
  }
}

export function getProfile() {
  const tree = levelsToTree(profile.flamebearer.levels, profile.flamebearer.names);
  return treeToNestedSetDataFrame(tree!, profile.metadata.units);
}
