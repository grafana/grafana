import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { DataTransformerConfig, Field, FieldType, DataFrame } from '../../types';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe';
import { transformDataFrame } from '../transformDataFrame';
import { ArrayVector } from '../../vector';
import { seriesToRowsTransformer, SeriesToRowsOptions } from './seriesToRows';

describe('Series to Rows', () => {
  beforeAll(() => {
    mockTransformationsRegistry([seriesToRowsTransformer]);
  });

  it('combine two classic time series into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsOptions> = {
      id: DataTransformerID.seriesToRows,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000] },
        { name: 'temp', type: FieldType.number, values: [1] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [2000] },
        { name: 'temp', type: FieldType.number, values: [-1] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA, seriesB]);
    const expected: Field[] = [
      createField('time', FieldType.time, [1000, 2000]),
      createField('metric', FieldType.string, ['A-series', 'B-series']),
      createField('value', FieldType.number, [1, -1]),
    ];

    expect(result[0].fields).toEqual(expected);
  });

  it('combine three classic time series into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsOptions> = {
      id: DataTransformerID.seriesToRows,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000] },
        { name: 'temp', type: FieldType.number, values: [1] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [2000] },
        { name: 'temp', type: FieldType.number, values: [-1] },
      ],
    });

    const seriesC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'time', type: FieldType.time, values: [500] },
        { name: 'temp', type: FieldType.number, values: [2] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA, seriesB, seriesC]);
    const expected: Field[] = [
      createField('time', FieldType.time, [500, 1000, 2000]),
      createField('metric', FieldType.string, ['C-series', 'A-series', 'B-series']),
      createField('value', FieldType.number, [2, 1, -1]),
    ];

    prettyPrint(result);
    expect(result[0].fields).toEqual(expected);
  });
});

const createField = (name: string, type: FieldType, values: any[]): Field => {
  return { name, type, values: new ArrayVector(values), config: {}, labels: undefined };
};

const prettyPrint = (result: DataFrame[]): void => {
  console.log(
    'result',
    result[0].fields.map(field => ({
      name: field.name,
      values: field.values.toArray().join(', '),
    }))
  );
};
