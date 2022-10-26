import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ValueMatcherID } from '../matchers/ids';
import { transformDataFrame } from '../transformDataFrame';

import { filterFieldsTransformer } from './filter';
import { filterFieldsByValuesTransformer } from './filterFieldByValue';
import { DataTransformerID } from './ids';

export const series = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
    { name: 'zero', type: FieldType.string, values: [0, 0, 0] },
    { name: 'null', type: FieldType.number, values: [null, null, null] },
    { name: 'values', type: FieldType.number, values: [1, 2, 3] },
  ],
});

describe('filterByName transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([filterFieldsByValuesTransformer, filterFieldsTransformer]);
  });

  it('returns original series if no options provided', async () => {
    const cfg = {
      id: DataTransformerID.filterFields,
      options: {},
    };

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      expect(filtered.fields.length).toBe(4);
    });
  });

  it('inclusion by pattern', async () => {
    const cfg = {
      id: DataTransformerID.filterFieldsByValue,
      options: {
        include: { valueMatcherConfig: { id: ValueMatcherID.equal, options: { value: 0 } } },
      },
    };

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      expect(filtered.fields.length).toBe(1);
      expect(filtered.fields[0].name).toBe('zero');
    });
  });

  it('exclusion by pattern', async () => {
    const cfg = {
      id: DataTransformerID.filterFieldsByValue,
      options: {
        exclude: { valueMatcherConfig: { id: ValueMatcherID.equal, options: { value: 0 } } },
      },
    };

    await expect(transformDataFrame([cfg], [series])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      expect(filtered.fields.length).toBe(3);
      expect(filtered.fields[0].name).toBe('time');
      expect(filtered.fields[1].name).toBe('null');
      expect(filtered.fields[2].name).toBe('values');
    });
  });
});
