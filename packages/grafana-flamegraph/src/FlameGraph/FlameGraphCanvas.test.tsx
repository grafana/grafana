import { convertPixelCoordinatesToBarCoordinates } from './FlameGraphCanvas';
import { textToDataContainer } from './testHelpers';

describe('convertPixelCoordinatesToBarCoordinates', () => {
  const container = textToDataContainer(`
      [0///////////]
      [1][3//][4///]
      [2]     [5///]
              [6]
    `)!;
  const root = container.getLevels()[0][0];
  const testPosFn = (pos: { x: number; y: number }) => {
    return convertPixelCoordinatesToBarCoordinates(
      pos,
      root,
      'children',
      container.getLevels().length,
      1,
      14,
      0,
      container.getCollapsedMap()
    )!;
  };

  it('returns correct item', () => {
    expect(testPosFn({ x: 4, y: 23 })!.itemIndexes[0]).toEqual(3);
  });

  it('returns no item when pointing to collapsed item', () => {
    expect(testPosFn({ x: 1, y: 45 })).toBeUndefined();
  });

  it('returns item when pointing to first collapsed item', () => {
    expect(testPosFn({ x: 1, y: 23 })!.itemIndexes[0]).toEqual(1);
  });

  it('returns correct shifted item because of collapsing', () => {
    expect(testPosFn({ x: 9, y: 45 })!.itemIndexes[0]).toEqual(6);
  });
});
