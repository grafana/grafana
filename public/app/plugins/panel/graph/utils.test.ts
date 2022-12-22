import { toDataFrame, FieldType } from '@grafana/data';

import { getDataTimeRange } from './utils';

describe('DataFrame utility functions', () => {
  const frame = toDataFrame({
    fields: [
      { name: 'fist', type: FieldType.time, values: [2, 3, 5] },
      { name: 'second', type: FieldType.time, values: [7, 8, 9] },
      { name: 'third', type: FieldType.number, values: [2000, 3000, 1000] },
    ],
  });
  it('Should find time range', () => {
    const range = getDataTimeRange([frame]);
    expect(range!.from).toEqual(2);
    expect(range!.to).toEqual(9);
  });
});
