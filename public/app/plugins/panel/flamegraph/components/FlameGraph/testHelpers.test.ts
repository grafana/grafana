import { createDataFrame } from '@grafana/data';

import { textToTree, treeToDataFrame } from './testHelpers';

describe('textToTree', () => {
  it('converts text to tree', () => {
    const tree = textToTree(`
      [1////////][2///]
      [3//][4///][5]
      [6]  [7]
           [8]
    `);

    const n8 = { label: '8', start: 5, value: 3, level: 4, self: 3, children: [] };
    const n7 = { label: '7', start: 5, value: 3, level: 3, self: 0, children: [n8] };
    const n4 = { label: '4', start: 5, value: 6, level: 2, self: 3, children: [n7] };

    const n6 = { label: '6', start: 0, value: 3, level: 3, self: 3, children: [] };
    const n3 = { label: '3', start: 0, value: 5, level: 2, self: 2, children: [n6] };

    const n1 = { label: '1', start: 0, value: 11, level: 1, self: 0, children: [n3, n4] };

    const n5 = { label: '5', start: 11, value: 3, level: 2, self: 3, children: [] };
    const n2 = { label: '2', start: 11, value: 6, level: 1, self: 3, children: [n5] };

    expect(tree).toEqual({
      label: 'root',
      level: 0,
      start: 0,
      value: 17,
      self: 0,
      children: [n1, n2],
    });
  });
});

describe('treeToDataframe', () => {
  it('converts tree to dataframe', () => {
    const tree = textToTree(`
      [1////////][2///]
      [3//][4///][5]
      [6]  [7]
           [8]
    `);
    const frame = treeToDataFrame(tree);
    expect(frame).toEqual(
      createDataFrame({
        fields: [
          { name: 'level', values: [0, 1, 2, 3, 2, 3, 4, 1, 2] },
          { name: 'value', values: [17, 11, 5, 3, 6, 3, 3, 6, 3] },
          { name: 'self', values: [0, 0, 2, 3, 3, 0, 3, 3, 3] },
          { name: 'label', values: ['root', '1', '3', '6', '4', '7', '8', '2', '5'] },
        ],
      })
    );
  });
});
