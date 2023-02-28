import { toDataFrame, dataFrameToJSON, DataFrameType } from '@grafana/data';

import { toNumericLong } from './numeric';

describe('Numeric frame conversion', () => {
  it('supports simple conversion', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'a', values: [1] },
        { name: 'b', values: [2] },
        { name: 'c', values: [3] },
      ],
    });
    const out = toNumericLong([frame]);
    expect(out.meta?.type).toEqual(DataFrameType.NumericLong);
    expect(dataFrameToJSON(out).data?.values).toEqual([
      ['a', 'b', 'c'],
      [1, 2, 3],
    ]);
  });

  it('supports labeled conversion', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'aa', values: [1], labels: { code: 'OAK', animal: 'cat' } },
        { name: 'bb', values: [2], labels: { code: 'SFO', animal: 'sloth' } },
      ],
    });
    const out = toNumericLong([frame]);
    expect(out.meta?.type).toEqual(DataFrameType.NumericLong);
    expect(out.fields.map((f) => f.name)).toEqual(['aa', 'bb', 'code', 'animal']);
    expect(dataFrameToJSON(out).data?.values).toEqual([
      [1, undefined],
      [undefined, 2],
      ['OAK', 'SFO'],
      ['cat', 'sloth'],
    ]);
  });
});
