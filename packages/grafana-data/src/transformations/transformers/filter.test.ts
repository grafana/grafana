import { FieldType } from '../../types/dataFrame';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldMatcherID } from '../matchers/ids';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { filterFieldsTransformer } from './filter';
import { transformDataFrame } from '../transformDataFrame';

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

  it('filters by include', () => {
    const cfg = {
      id: DataTransformerID.filterFields,
      options: {
        include: { id: FieldMatcherID.numeric },
      },
    };

    const filtered = transformDataFrame([cfg], [simpleSeriesWithTypes])[0];
    expect(filtered.fields.length).toBe(1);
    expect(filtered.fields[0].name).toBe('D');
  });
});
