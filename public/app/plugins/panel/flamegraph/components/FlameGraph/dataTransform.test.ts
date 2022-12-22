import { DataFrameView, MutableDataFrame } from '@grafana/data';

import { Item, nestedSetToLevels } from './dataTransform';

describe('nestedSetToLevels', () => {
  it('converts nested set data frame to levels', () => {
    const frame = new MutableDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 2, 3, 2, 1, 2, 3, 4] },
        { name: 'value', values: [10, 5, 3, 1, 1, 4, 3, 2, 1] },
        { name: 'label', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
      ],
    });
    const levels = nestedSetToLevels(new DataFrameView<Item>(frame));
    expect(levels).toEqual([
      [{ level: 0, value: 10, start: 0, label: '1' }],
      [
        { level: 1, value: 5, start: 0, label: '2' },
        { level: 1, value: 4, start: 5, label: '6' },
      ],
      [
        { level: 2, value: 3, start: 0, label: '3' },
        { level: 2, value: 1, start: 3, label: '5' },
        { level: 2, value: 3, start: 5, label: '7' },
      ],
      [
        { level: 3, value: 1, start: 0, label: '4' },
        { level: 3, value: 2, start: 5, label: '8' },
      ],
      [{ level: 4, value: 1, start: 5, label: '9' }],
    ]);
  });

  it('converts nested set data if multiple same level items', () => {
    const frame = new MutableDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [10, 5, 3, 1] },
        { name: 'label', values: ['1', '2', '3', '4'] },
      ],
    });
    const levels = nestedSetToLevels(new DataFrameView<Item>(frame));
    expect(levels).toEqual([
      [{ level: 0, value: 10, start: 0, label: '1' }],
      [
        { level: 1, value: 5, start: 0, label: '2' },
        { level: 1, value: 3, start: 5, label: '3' },
        { level: 1, value: 1, start: 8, label: '4' },
      ],
    ]);
  });
});
