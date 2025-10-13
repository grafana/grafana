import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { FieldMatcherID } from '../matchers/ids';
import { transformDataFrame } from '../transformDataFrame';

import { filterFieldsTransformer } from './filter';
import { DataTransformerID } from './ids';

export const simpleSeriesWithTypes = toDataFrame({
  fields: [
    { name: 'A', type: FieldType.time, values: [1000, 2000] },
    { name: 'B', type: FieldType.boolean, values: [true, false] },
    { name: 'C', type: FieldType.string, values: ['a', 'b'] },
    { name: 'D', type: FieldType.number, values: [1, 2] },
  ],
});

describe('Filter Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([filterFieldsTransformer]);
  });

  it('filters by include', async () => {
    const cfg = {
      id: DataTransformerID.filterFields,
      options: {
        include: { id: FieldMatcherID.numeric },
      },
    };

    await expect(transformDataFrame([cfg], [simpleSeriesWithTypes])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      expect(filtered.fields.length).toBe(1);
      expect(filtered.fields[0].name).toBe('D');
    });
  });
});
