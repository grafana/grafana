import { createDataFrame } from '@grafana/data';

import { FlameGraphDataContainer, LevelItem, nestedSetToLevels } from './dataTransform';

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

    const n9: LevelItem = { itemIndexes: [8], start: 5, children: [], value: 1 };
    const n8: LevelItem = { itemIndexes: [7], start: 5, children: [n9], value: 2 };
    const n7: LevelItem = { itemIndexes: [6], start: 5, children: [n8], value: 3 };
    const n6: LevelItem = { itemIndexes: [5], start: 5, children: [n7], value: 4 };
    const n5: LevelItem = { itemIndexes: [4], start: 3, children: [], value: 1 };
    const n4: LevelItem = { itemIndexes: [3], start: 0, children: [], value: 1 };
    const n3: LevelItem = { itemIndexes: [2], start: 0, children: [n4], value: 3 };
    const n2: LevelItem = { itemIndexes: [1], start: 0, children: [n3, n5], value: 5 };
    const n1: LevelItem = { itemIndexes: [0], start: 0, children: [n2, n6], value: 10 };

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

    const n4: LevelItem = { itemIndexes: [3], start: 8, children: [], value: 1 };
    const n3: LevelItem = { itemIndexes: [2], start: 5, children: [], value: 3 };
    const n2: LevelItem = { itemIndexes: [1], start: 0, children: [], value: 5 };
    const n1: LevelItem = { itemIndexes: [0], start: 0, children: [n2, n3, n4], value: 10 };

    n2.parents = [n1];
    n3.parents = [n1];
    n4.parents = [n1];

    expect(levels[0]).toEqual([n1]);
    expect(levels[1]).toEqual([n2, n3, n4]);
  });
});
