import { createDataFrame, FieldType } from '@grafana/data';

import {
  CollapsedMapBuilder,
  FlameGraphDataContainer,
  LevelItem,
  nestedSetToLevels,
  CollapsedMap,
} from './dataTransform';
import { textToDataContainer } from './testHelpers';

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
        { name: 'label', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], type: FieldType.string },
        { name: 'self', values: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
      ],
    });
    const [levels] = nestedSetToLevels(new FlameGraphDataContainer(frame, { collapsing: true }));

    const n9: LevelItem = { itemIndexes: [8], start: 5, children: [], value: 1, level: 4 };
    const n8: LevelItem = { itemIndexes: [7], start: 5, children: [n9], value: 2, level: 3 };
    const n7: LevelItem = { itemIndexes: [6], start: 5, children: [n8], value: 3, level: 2 };
    const n6: LevelItem = { itemIndexes: [5], start: 5, children: [n7], value: 4, level: 1 };
    const n5: LevelItem = { itemIndexes: [4], start: 3, children: [], value: 1, level: 2 };
    const n4: LevelItem = { itemIndexes: [3], start: 0, children: [], value: 1, level: 3 };
    const n3: LevelItem = { itemIndexes: [2], start: 0, children: [n4], value: 3, level: 2 };
    const n2: LevelItem = { itemIndexes: [1], start: 0, children: [n3, n5], value: 5, level: 1 };
    const n1: LevelItem = { itemIndexes: [0], start: 0, children: [n2, n6], value: 10, level: 0 };

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
        { name: 'label', values: ['1', '2', '3', '4'], type: FieldType.string },
        { name: 'self', values: [10, 5, 3, 1] },
      ],
    });
    const [levels] = nestedSetToLevels(new FlameGraphDataContainer(frame, { collapsing: true }));

    const n4: LevelItem = { itemIndexes: [3], start: 8, children: [], value: 1, level: 1 };
    const n3: LevelItem = { itemIndexes: [2], start: 5, children: [], value: 3, level: 1 };
    const n2: LevelItem = { itemIndexes: [1], start: 0, children: [], value: 5, level: 1 };
    const n1: LevelItem = { itemIndexes: [0], start: 0, children: [n2, n3, n4], value: 10, level: 0 };

    n2.parents = [n1];
    n3.parents = [n1];
    n4.parents = [n1];

    expect(levels[0]).toEqual([n1]);
    expect(levels[1]).toEqual([n2, n3, n4]);
  });

  it('handles strings that collide with inherited prototype method names', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [10, 5, 3, 1] },
        { name: 'label', values: ['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf'], type: FieldType.string },
        { name: 'self', values: [10, 5, 3, 1] },
      ],
    });
    const [levels] = nestedSetToLevels(new FlameGraphDataContainer(frame, { collapsing: true }));

    const n4: LevelItem = { itemIndexes: [3], start: 8, children: [], value: 1, level: 1 };
    const n3: LevelItem = { itemIndexes: [2], start: 5, children: [], value: 3, level: 1 };
    const n2: LevelItem = { itemIndexes: [1], start: 0, children: [], value: 5, level: 1 };
    const n1: LevelItem = { itemIndexes: [0], start: 0, children: [n2, n3, n4], value: 10, level: 0 };

    n2.parents = [n1];
    n3.parents = [n1];
    n4.parents = [n1];

    expect(levels[0]).toEqual([n1]);
    expect(levels[1]).toEqual([n2, n3, n4]);
  });
});

describe('FlameGraphDataContainer', () => {
  it('creates correct collapse map', () => {
    const container = textToDataContainer(`
      [0//////////////]
      [1][3//][6///]
      [2][4]  [7///]
         [5]  [8///]
              [9///]
    `)!;

    const collapsedMap = container.getCollapsedMap();
    expect(Array.from(collapsedMap.keys()).map((item) => item.itemIndexes[0])).toEqual([1, 2, 4, 5, 6, 7, 8, 9]);

    expect(Array.from(collapsedMap.values())[0]).toMatchObject({
      collapsed: true,
      items: [{ itemIndexes: [1] }, { itemIndexes: [2] }],
    });
  });

  it('creates correct collapse map 2', () => {
    // Should not create any groups because even though the 1 is within threshold it has a sibling
    const container = textToDataContainer(
      `
      [0////////////////////////////////]
      [1/////////////////////////////][2]
    `,
      { collapsing: true, collapsingThreshold: 0.5 }
    )!;

    const collapsedMap = container.getCollapsedMap();
    expect(Array.from(collapsedMap.keys()).length).toEqual(0);
  });

  it('creates empty collapse map if no items are similar', () => {
    const container = textToDataContainer(`
      [0//////////////]
      [1][3//][6///]
              [9/]
    `)!;

    const collapsedMap = container.getCollapsedMap();
    expect(Array.from(collapsedMap.keys()).length).toEqual(0);
  });
});

describe('CollapsedMapContainer', () => {
  const defaultItem: LevelItem = {
    itemIndexes: [0],
    value: 100,
    level: 0,
    children: [],
    start: 0,
  };

  it('groups items if they are within value threshold', () => {
    const container = new CollapsedMapBuilder();

    const child2: LevelItem = {
      ...defaultItem,
      itemIndexes: [2],
      value: 99.1,
    };

    const child1: LevelItem = {
      ...defaultItem,
      itemIndexes: [1],
      children: [child2],
    };

    const parent: LevelItem = {
      ...defaultItem,
      children: [child1],
    };

    container.addItem(child1, parent);
    container.addItem(child2, child1);
    expect(container.getCollapsedMap().get(child1)).toMatchObject({ collapsed: true, items: [parent, child1, child2] });
    expect(container.getCollapsedMap().get(child2)).toMatchObject({ collapsed: true, items: [parent, child1, child2] });
    expect(container.getCollapsedMap().get(parent)).toMatchObject({ collapsed: true, items: [parent, child1, child2] });
  });

  it("doesn't group items if they are outside value threshold", () => {
    const container = new CollapsedMapBuilder();

    const parent: LevelItem = {
      ...defaultItem,
    };

    const child: LevelItem = {
      ...defaultItem,
      itemIndexes: [1],
      value: 98,
    };

    container.addItem(child, parent);
    expect(container.getCollapsedMap().size()).toBe(0);
  });

  it("doesn't group items if parent has multiple children", () => {
    const container = new CollapsedMapBuilder();

    const child1: LevelItem = {
      ...defaultItem,
      itemIndexes: [1],
      value: 99.1,
    };

    const child2: LevelItem = {
      ...defaultItem,
      itemIndexes: [2],
      value: 0.09,
    };

    const parent: LevelItem = {
      ...defaultItem,
      children: [child1, child2],
    };

    container.addItem(child1, parent);
    expect(container.getCollapsedMap().size()).toBe(0);
  });
});

describe('CollapsedMap', () => {
  function getMap() {
    const container = textToDataContainer(`
      [0///////////]
      [1][3//][6///]
      [2]     [9/]
    `)!;

    const items = container.getLevels();

    return {
      map: new CollapsedMap(
        new Map([
          [items[1][0], { items: [items[1][0], items[2][0]], collapsed: false }],
          [items[1][2], { items: [items[1][2], items[2][1]], collapsed: true }],
        ])
      ),
      items,
    };
  }

  it('collapses and expands single item', () => {
    const { map: collapsedMap, items } = getMap();
    let newMap = collapsedMap.setCollapsedStatus(items[1][0], true);
    expect(collapsedMap.get(items[1][0])?.collapsed).toBe(false);
    expect(newMap.get(items[1][0])?.collapsed).toBe(true);

    newMap = collapsedMap.setCollapsedStatus(items[1][2], false);
    expect(collapsedMap.get(items[1][2])?.collapsed).toBe(true);
    expect(newMap.get(items[1][2])?.collapsed).toBe(false);
  });

  it('collapses and expands all items', () => {
    const { map: collapsedMap, items } = getMap();
    let newMap = collapsedMap.setAllCollapsedStatus(true);
    expect(collapsedMap.get(items[1][0])?.collapsed).toBe(false);
    expect(newMap.get(items[1][0])?.collapsed).toBe(true);
    expect(newMap.get(items[1][2])?.collapsed).toBe(true);

    newMap = collapsedMap.setAllCollapsedStatus(false);
    expect(collapsedMap.get(items[1][2])?.collapsed).toBe(true);
    expect(newMap.get(items[1][0])?.collapsed).toBe(false);
    expect(newMap.get(items[1][2])?.collapsed).toBe(false);
  });
});
