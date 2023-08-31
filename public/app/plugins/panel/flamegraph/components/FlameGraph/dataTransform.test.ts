import { createDataFrame, DataFrameDTO, FieldType } from '@grafana/data';

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
        { name: 'label', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], type: FieldType.string },
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
        { name: 'label', values: ['1', '2', '3', '4'], type: FieldType.string },
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

  it('handles diff data', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [10, 5, 3, 1] },
        { name: 'valueRight', values: [10, 4, 2, 1] },
        { name: 'label', values: ['1', '2', '3', '4'], type: FieldType.string },
        { name: 'self', values: [10, 5, 3, 1] },
        { name: 'selfRight', values: [10, 4, 2, 1] },
      ],
    });
    const [levels] = nestedSetToLevels(new FlameGraphDataContainer(frame));

    expect(levels[1][0]).toMatchObject({ itemIndexes: [1], value: 9, valueRight: 4 });
    expect(levels[1][1]).toMatchObject({ itemIndexes: [2], value: 5, valueRight: 2 });
    expect(levels[1][2]).toMatchObject({ itemIndexes: [3], value: 2, valueRight: 1 });
  });
});

describe('diffFlamebearerToDataFrameDTO', () => {
  it('works', function () {
    // The main point of this test is to have some easy way to convert flamebearer data to data frame, so it can be used
    // for example in test data source. Reason is in grafana we don't have a way to produce diff frames and so we have
    // to use pyro app which gives you flamebearer format. So if you need to create a diff data frame to save somewhere
    // just log the frame and copy the values.

    const levels = [
      [0, 378, 0, 0, 316, 0, 0],
      [0, 12, 0, 0, 16, 0, 1],
    ];
    const names = ['total', 'System.Threading!ThreadPoolWorkQueueThreadLocals.Finalize'];
    const frame = diffFlamebearerToDataFrameDTO(levels, names);

    // console.log(JSON.stringify(frame));
    expect(frame).toMatchObject({
      name: 'response',
      meta: { preferredVisualisationType: 'flamegraph' },
      fields: [
        { name: 'level', values: [0, 1] },
        { name: 'label', values: ['total', 'System.Threading!ThreadPoolWorkQueueThreadLocals.Finalize'] },
        { name: 'self', values: [0, 0] },
        { name: 'value', values: [378, 12] },
        { name: 'selfRight', values: [0, 0] },
        { name: 'valueRight', values: [316, 16] },
      ],
    });
  });
});

function getNodes(level: number[], names: string[]) {
  const nodes = [];
  for (let i = 0; i < level.length; i += 7) {
    nodes.push({
      level: 0,
      label: names[level[i + 6]],
      self: level[i + 2],
      val: level[i + 1],
      selfRight: level[i + 5],
      valRight: level[i + 4],
      valTotal: level[i + 1] + level[i + 4],
      offset: level[i],
      offsetRight: level[i + 3],
      offsetTotal: level[i] + level[i + 3],
      children: [],
    });
  }
  return nodes;
}

function diffFlamebearerToDataFrameDTO(levels: number[][], names: string[]) {
  const nodeLevels: any[][] = [];
  for (let i = 0; i < levels.length; i++) {
    nodeLevels[i] = [];
    for (const node of getNodes(levels[i], names)) {
      node.level = i;
      nodeLevels[i].push(node);
      if (i > 0) {
        const prevNodesInLevel = nodeLevels[i].slice(0, -1);
        const currentNodeStart =
          prevNodesInLevel.reduce((acc, n) => n.offsetTotal + n.valTotal + acc, 0) + node.offsetTotal;

        const prevLevel = nodeLevels[i - 1];
        let prevLevelOffset = 0;
        for (const prevLevelNode of prevLevel) {
          const parentNodeStart = prevLevelOffset + prevLevelNode.offsetTotal;
          const parentNodeEnd = parentNodeStart + prevLevelNode.valTotal;

          if (parentNodeStart <= currentNodeStart && parentNodeEnd > currentNodeStart) {
            prevLevelNode.children.push(node);
            break;
          } else {
            prevLevelOffset += prevLevelNode.offsetTotal + prevLevelNode.valTotal;
          }
        }
      }
    }
  }

  const root = nodeLevels[0][0];
  const stack = [root];

  const labelValues = [];
  const levelValues = [];
  const selfValues = [];
  const valueValues = [];
  const selfRightValues = [];
  const valueRightValues = [];

  while (stack.length) {
    const node = stack.shift();
    labelValues.push(node.label);
    levelValues.push(node.level);
    selfValues.push(node.self);
    valueValues.push(node.val);
    selfRightValues.push(node.selfRight);
    valueRightValues.push(node.valRight);
    stack.unshift(...node.children);
  }

  const frame: DataFrameDTO = {
    name: 'response',
    meta: { preferredVisualisationType: 'flamegraph' },
    fields: [
      { name: 'level', values: levelValues },
      { name: 'label', values: labelValues, type: FieldType.string },
      { name: 'self', values: selfValues },
      { name: 'value', values: valueValues },
      { name: 'selfRight', values: selfRightValues },
      { name: 'valueRight', values: valueRightValues },
    ],
  };

  return frame;
}
