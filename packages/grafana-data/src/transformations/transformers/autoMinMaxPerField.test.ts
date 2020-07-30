import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { DataTransformerConfig, FieldType, FieldConfig } from '../../types';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe';
import { transformDataFrame } from '../transformDataFrame';
import { autoMinMaxPerFieldTransformer, AutoMinMaxPerFieldTransformerOptions } from './autoMinMaxPerField';

describe('Set min/max configs per field', () => {
  beforeAll(() => {
    mockTransformationsRegistry([autoMinMaxPerFieldTransformer]);
  });

  it('sets min/max values for fields independently', () => {
    const cfg: DataTransformerConfig<AutoMinMaxPerFieldTransformerOptions> = {
      id: DataTransformerID.autoMinMaxPerField,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'smallField', type: FieldType.number, values: [0.1, 0.2, 0.3] },
        { name: 'largeFields', type: FieldType.number, values: [101, 102, 103] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA]);
    const expectedConfigs: FieldConfig[] = [
      { min: 0.1, max: 0.3 },
      { min: 101, max: 103 },
    ];

    expect(result[0].fields.map(field => field.config)).toEqual(expectedConfigs);
  });

  it('ignores fields that are not numbers', () => {
    const cfg: DataTransformerConfig<AutoMinMaxPerFieldTransformerOptions> = {
      id: DataTransformerID.autoMinMaxPerField,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'fieldsA', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'fieldsX', type: FieldType.string, values: ['x', 'y', 'z'] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA]);
    const expectedConfigs: FieldConfig[] = [{}, {}];

    expect(result[0].fields.map(field => field.config)).toEqual(expectedConfigs);
  });
});
