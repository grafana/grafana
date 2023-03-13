import { MutableDataFrame } from '@grafana/data';

import { FlameGraphDataContainer, nestedSetToLevels } from './dataTransform';

describe('nestedSetToLevels', () => {
  it('converts nested set data frame to levels', () => {
    const frame = new MutableDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 2, 3, 2, 1, 2, 3, 4] },
        { name: 'value', values: [10, 5, 3, 1, 1, 4, 3, 2, 1] },
        { name: 'label', values: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
        { name: 'self', values: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
      ],
    });
    const levels = nestedSetToLevels(new FlameGraphDataContainer(frame));
    expect(levels).toEqual([
      [{ start: 0, itemIndex: 0 }],
      [
        { start: 0, itemIndex: 1 },
        { start: 5, itemIndex: 5 },
      ],
      [
        { start: 0, itemIndex: 2 },
        { start: 3, itemIndex: 4 },
        { start: 5, itemIndex: 6 },
      ],
      [
        { start: 0, itemIndex: 3 },
        { start: 5, itemIndex: 7 },
      ],
      [{ start: 5, itemIndex: 8 }],
    ]);
  });

  it('converts nested set data if multiple same level items', () => {
    const frame = new MutableDataFrame({
      fields: [
        { name: 'level', values: [0, 1, 1, 1] },
        { name: 'value', values: [10, 5, 3, 1] },
        { name: 'label', values: ['1', '2', '3', '4'] },
        { name: 'self', values: [10, 5, 3, 1] },
      ],
    });
    const levels = nestedSetToLevels(new FlameGraphDataContainer(frame));
    expect(levels).toEqual([
      [{ start: 0, itemIndex: 0 }],
      [
        { start: 0, itemIndex: 1 },
        { start: 5, itemIndex: 2 },
        { start: 8, itemIndex: 3 },
      ],
    ]);
  });
});
