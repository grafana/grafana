import { LevelItem } from './dataTransform';
import { levelsToString, textToDataContainer, trimLevelsString } from './testHelpers';

describe('textToDataContainer', () => {
  it('converts text to correct data container', () => {
    const container = textToDataContainer(`
      [1//////////////]
      [2][4//][7///]
      [3][5]
         [6]
    `)!;

    const levels = container.getLevels();

    expect(levels[0][0]).toMatchObject({ label: '1', self: 3, value: 17, start: 0 });
    expect(childrenParents(levels[0][0])).toEqual([['2', '4', '7'], []]);

    expect(levels[1][0]).toMatchObject({ label: '2', self: 0, value: 3, start: 0 });
    expect(childrenParents(levels[1][0])).toEqual([['3'], ['1']]);

    expect(levels[2][0]).toMatchObject({ label: '3', self: 3, value: 3, start: 0 });
    expect(childrenParents(levels[2][0])).toEqual([[], ['2']]);

    expect(levels[1][1]).toMatchObject({ label: '4', self: 2, value: 5, start: 3 });
    expect(childrenParents(levels[1][1])).toEqual([['5'], ['1']]);

    expect(levels[2][1]).toMatchObject({ label: '5', self: 0, value: 3, start: 3 });
    expect(childrenParents(levels[2][1])).toEqual([['6'], ['4']]);

    expect(levels[3][0]).toMatchObject({ label: '6', self: 3, value: 3, start: 3 });
    expect(childrenParents(levels[3][0])).toEqual([[], ['5']]);

    expect(levels[1][2]).toMatchObject({ label: '7', self: 6, value: 6, start: 8 });
    expect(childrenParents(levels[1][2])).toEqual([[], ['1']]);
  });
});

function childrenParents(item: LevelItem) {
  return [item.children.map((n) => n.label), (item.parents || []).map((n) => n.label)];
}

describe('levelsToString', () => {
  it('converts data container to correct string', () => {
    const stringGraph = trimLevelsString(`
      [1//////////////]
      [2][4//][7///]
      [3][5]
         [6]
    `);
    const container = textToDataContainer(stringGraph)!;
    expect(levelsToString(container.getLevels(), container)).toEqual(stringGraph);
  });
});
