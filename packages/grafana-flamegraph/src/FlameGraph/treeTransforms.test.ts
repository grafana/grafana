import { levelsToString, textToDataContainer, trimLevelsString } from './testHelpers';
import { mergeParentSubtrees, mergeSubtrees } from './treeTransforms';

describe('mergeSubtrees', () => {
  it('correctly merges trees', () => {
    const container = textToDataContainer(`
      [0////////////]
      [1//][4/////]
      [2]  [1////]
      [3]  [2][7/]
              [8]
    `)!;
    const levels = container.getLevels()!;
    const node1 = levels[1][0];
    const node2 = levels[2][1];
    const merged = mergeSubtrees([node1, node2], container);

    expect(merged[0][0]).toMatchObject({ itemIndexes: [1, 5], start: 0 });
    expect(merged[1][0]).toMatchObject({ itemIndexes: [2, 6], start: 0 });
    expect(merged[1][1]).toMatchObject({ itemIndexes: [7], start: 6 });
    expect(merged[2][0]).toMatchObject({ itemIndexes: [3], start: 0 });
    expect(merged[2][1]).toMatchObject({ itemIndexes: [8], start: 6 });

    expect(levelsToString(merged, container)).toEqual(
      trimLevelsString(`
        [1/////////]
        [2///][7/]
        [3]   [8]
      `)
    );
  });

  it('normalizes the tree offset for single node', () => {
    const container = textToDataContainer(`
      [0////////////]
      [1//][4/////]
      [2]  [5////]
      [3]  [6][7/]
              [8]
    `)!;
    const levels = container.getLevels()!;
    const node = levels[1][1];
    const merged = mergeSubtrees([node], container);

    expect(merged[0][0]).toMatchObject({ itemIndexes: [4], start: 0 });
    expect(merged[1][0]).toMatchObject({ itemIndexes: [5], start: 0 });
    expect(merged[2][0]).toMatchObject({ itemIndexes: [6], start: 0 });
    expect(merged[2][1]).toMatchObject({ itemIndexes: [7], start: 3 });
    expect(merged[3][0]).toMatchObject({ itemIndexes: [8], start: 3 });

    expect(levelsToString(merged, container)).toEqual(
      trimLevelsString(`
        [4/////]
        [5////]
        [6][7/]
           [8]
      `)
    );
  });

  it('handles repeating items', () => {
    const container = textToDataContainer(`
      [0]
      [0]
      [0]
      [0]
    `)!;
    const levels = container.getLevels()!;
    const merged = mergeSubtrees([levels[0][0]], container);
    expect(levelsToString(merged, container)).toEqual(
      trimLevelsString(`
        [0]
        [0]
        [0]
        [0]
      `)
    );
  });
});

describe('mergeParentSubtrees', () => {
  it('correctly merges trees', () => {
    const container = textToDataContainer(`
      [0/////////////]
      [1//][4/////][6]
      [2]  [5/////]
      [6]  [6/][8/]
           [7]
    `)!;

    const levels = container.getLevels()!;
    const merged = mergeParentSubtrees([levels[3][0], levels[3][1], levels[1][2]], container);

    expect(merged[0][0]).toMatchObject({ itemIndexes: [0], start: 3, value: 3 });
    expect(merged[0][1]).toMatchObject({ itemIndexes: [0], start: 6, value: 4 });
    expect(merged[1][0]).toMatchObject({ itemIndexes: [1], start: 3, value: 3 });
    expect(merged[1][1]).toMatchObject({ itemIndexes: [4], start: 6, value: 4 });
    expect(merged[2][0]).toMatchObject({ itemIndexes: [0], start: 0, value: 3 });
    expect(merged[2][1]).toMatchObject({ itemIndexes: [2], start: 3, value: 3 });
    expect(merged[2][2]).toMatchObject({ itemIndexes: [5], start: 6, value: 4 });
    expect(merged[3][0]).toMatchObject({ itemIndexes: [3, 6, 9], start: 0, value: 10 });

    expect(levelsToString(merged, container)).toEqual(
      trimLevelsString(`
         [0][0/]
         [1][4/]
      [0][2][5/]
      [6///////]
    `)
    );
  });

  it('handles repeating nodes in single parent tree', () => {
    const container = textToDataContainer(`
      [0]
      [1]
      [2]
      [1]
      [4]
    `)!;

    const levels = container.getLevels()!;
    const merged = mergeParentSubtrees([levels[1][0], levels[3][0]], container);
    expect(levelsToString(merged, container)).toEqual(
      trimLevelsString(`
         [0]
         [1]
      [0][2]
      [1///]
    `)
    );
  });

  it('handles single node', () => {
    const container = textToDataContainer(`[0]`)!;
    const levels = container.getLevels()!;
    const merged = mergeParentSubtrees([levels[0][0]], container);
    expect(levelsToString(merged, container)).toEqual(trimLevelsString(`[0]`));
  });

  it('handles multiple same nodes', () => {
    const container = textToDataContainer(`
      [0]
      [0]
      [0]
      [0]
      [0]
    `)!;

    const levels = container.getLevels()!;
    const merged = mergeParentSubtrees([levels[4][0]], container);
    expect(levelsToString(merged, container)).toEqual(
      trimLevelsString(`
      [0]
      [0]
      [0]
      [0]
      [0]
    `)
    );
  });
});
