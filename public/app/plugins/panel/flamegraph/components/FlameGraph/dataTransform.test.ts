import { createDataFrame } from '@grafana/data';

import { FlameGraphDataContainer, LevelItem, nestedSetToLevels } from './dataTransform';
import { frameFromText } from './testHelpers';

describe('nestedSetToLevels', () => {
  it('converts nested set data frame to levels', () => {
    // [1------]
    // [2---][6]
    // [3][5][7]
    // [4]   [8]
    //       [9]
    const frame = createDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 2, 3, 2, 1, 2, 3, 4] },
        { name: 'value', values: [10, 5, 3, 1, 1, 4, 3, 2, 1] },
        { name: 'label', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
        { name: 'self', values: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
      ],
    });
    const [levels] = nestedSetToLevels(new FlameGraphDataContainer(frame));

    const n9: LevelItem = { itemIndexes: [8], start: 5, children: [] };
    const n8: LevelItem = { itemIndexes: [7], start: 5, children: [n9] };
    const n7: LevelItem = { itemIndexes: [6], start: 5, children: [n8] };
    const n6: LevelItem = { itemIndexes: [5], start: 5, children: [n7] };
    const n5: LevelItem = { itemIndexes: [4], start: 3, children: [] };
    const n4: LevelItem = { itemIndexes: [3], start: 0, children: [] };
    const n3: LevelItem = { itemIndexes: [2], start: 0, children: [n4] };
    const n2: LevelItem = { itemIndexes: [1], start: 0, children: [n3, n5] };
    const n1: LevelItem = { itemIndexes: [0], start: 0, children: [n2, n6] };

    n2.parents = [n1];
    n6.parents = [n1];
    n3.parents = [n2];
    n5.parents = [n2];
    n4.parents = [n3];
    n7.parents = [n6];
    n8.parents = [n7];
    n9.parents = [n8];

    expect(levels[0]).toEqual([n1]);
    expect(levels[1]).toEqual([n2, n6]);
    expect(levels[2]).toEqual([n3, n5, n7]);
    expect(levels[3]).toEqual([n4, n8]);
    expect(levels[4]).toEqual([n9]);
  });

  it('converts nested set data if multiple same level items', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [10, 5, 3, 1] },
        { name: 'label', values: ['1', '2', '3', '4'] },
        { name: 'self', values: [10, 5, 3, 1] },
      ],
    });
    const [levels] = nestedSetToLevels(new FlameGraphDataContainer(frame));

    const n4: LevelItem = { itemIndexes: [3], start: 8, children: [] };
    const n3: LevelItem = { itemIndexes: [2], start: 5, children: [] };
    const n2: LevelItem = { itemIndexes: [1], start: 0, children: [] };
    const n1: LevelItem = { itemIndexes: [0], start: 0, children: [n2, n3, n4] };

    n2.parents = [n1];
    n3.parents = [n1];
    n4.parents = [n1];

    expect(levels[0]).toEqual([n1]);
    expect(levels[1]).toEqual([n2, n3, n4]);
  });
});

describe('FlameGraphDataContainer', () => {
  describe('getCallersTree', () => {
    it('returns correct tree', () => {
      const frame = frameFromText(`
      [1------]
      [2---][6]
      [3][5][2]
      [4]   [3]
            [9]
      `);

      const container = new FlameGraphDataContainer(frame);
      const tree = container.getCallersTree('3');

      // const n9: LevelItem = { itemIndexes: [9], start: 0, children: [] };
      // const n4: LevelItem = { itemIndexes: [4], start: 0, children: [] };
      // const n5: LevelItem = { itemIndexes: [5], start: 0, children: [] };
      // const n3: LevelItem = { itemIndexes: [3, 8], start: 0, children: [n4, n9] };
      // const n2: LevelItem = { itemIndexes: [2, 7], start: 0, children: [n3, n5] };
      // const n6: LevelItem = { itemIndexes: [6], start: 0, children: [n2] };
      // const n1: LevelItem = { itemIndexes: [1], start: 0, children: [n2] };
      // n2.parents = [n1, n6]
      // n3.parents = [n2]
      // n4.parents = [n3]
      // n5.parents = [n2]
      // n6.parents = [n1]
      // n9.parents = [n3]

      expect(tree.itemIndexes).toEqual([3, 8]);
      expect(tree.parents?.length).toEqual(1);
      expect(tree.parents?.[0].itemIndexes).toEqual([2, 7]);
      expect(tree.parents?.[0].parents?.[0].itemIndexes).toEqual([1]);
      expect(tree.parents?.[0].parents?.[1].itemIndexes).toEqual([6]);
      expect(tree.parents?.[0].parents?.[1].parents?.[0].itemIndexes).toEqual([1]);
    });
  });
});
