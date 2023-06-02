import { textToDataContainer } from './testHelpers';
import { mergeSubtrees } from './treeTransforms';

// describe('shiftSubtree', () => {
//   it('correctly shifts the tree', () => {
//     const levels = makeLevels(10);
//     expect(shiftSubtree(levels[0][0])).toEqual(makeLevels());
//   });
// });

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

    // [1/////////]
    // [2///][7/]
    // [3]   [8]
    expect(merged[0][0]).toMatchObject({ itemIndexes: [1, 5], start: 0 });
    expect(merged[1][0]).toMatchObject({ itemIndexes: [2, 6], start: 0 });
    expect(merged[1][1]).toMatchObject({ itemIndexes: [7], start: 6 });
    expect(merged[2][0]).toMatchObject({ itemIndexes: [3], start: 0 });
    expect(merged[2][1]).toMatchObject({ itemIndexes: [8], start: 6 });
  });

  it('normalizes the tree offset', () => {
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

    // [4/////]
    // [5////]
    // [6][7/]
    //    [8]
    expect(merged[0][0]).toMatchObject({ itemIndexes: [4], start: 0 });
    expect(merged[1][0]).toMatchObject({ itemIndexes: [5], start: 0 });
    expect(merged[2][0]).toMatchObject({ itemIndexes: [6], start: 0 });
    expect(merged[2][1]).toMatchObject({ itemIndexes: [7], start: 3 });
    expect(merged[3][0]).toMatchObject({ itemIndexes: [8], start: 3 });
  });
});
