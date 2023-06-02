import { LevelItem } from './dataTransform';
import { textToDataContainer } from './testHelpers';

describe('textToDataContainer', () => {
  it('converts text to correct data container', () => {
    const container = textToDataContainer(`
      [1//////////////]
      [2][4//][7///]
      [3][5]
         [6]
    `)!;

    const n6: LevelItem = { itemIndexes: [5], start: 3, children: [] };

    const n5: LevelItem = { itemIndexes: [4], start: 3, children: [n6] };
    const n3: LevelItem = { itemIndexes: [2], start: 0, children: [] };

    const n7: LevelItem = { itemIndexes: [6], start: 8, children: [] };
    const n4: LevelItem = { itemIndexes: [3], start: 3, children: [n5] };
    const n2: LevelItem = { itemIndexes: [1], start: 0, children: [n3] };

    const n1: LevelItem = { itemIndexes: [0], start: 0, children: [n2, n4, n7] };

    n2.parents = [n1];
    n4.parents = [n1];
    n7.parents = [n1];

    n3.parents = [n2];
    n5.parents = [n4];

    n6.parents = [n5];

    const levels = container.getLevels();

    expect(levels[0][0]).toEqual(n1);
  });
});
