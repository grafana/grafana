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

    expect(result[0].fields).toMatchObject(expected);
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

    expect(result[0].fields).toMatchObject(expected);
  });

  it('combine three time series with multiple values into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsOptions> = {
      id: DataTransformerID.seriesToRows,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000] },
        { name: 'temp', type: FieldType.number, values: [1] },
        { name: 'humidity', type: FieldType.number, values: [10] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000] },
        { name: 'temp', type: FieldType.number, values: [-1] },
      ],
    });

    const seriesC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'time', type: FieldType.time, values: [500] },
        { name: 'temp', type: FieldType.number, values: [2] },
        { name: 'humidity', type: FieldType.number, values: [5] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA, seriesB, seriesC]);
    const expected: Field[] = [
      createField('time', FieldType.time, [500, 1000, 1000]),
      createField('metric', FieldType.string, ['C-series', 'A-series', 'B-series']),
      createField('temp', FieldType.number, [2, 1, -1]),
      createField('humidity', FieldType.number, [5, 10, null]),
    ];

    expect(result[0].fields).toMatchObject(expected);
  });

  it('combine three time series with multiple values and ISO dates into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsOptions> = {
      id: DataTransformerID.seriesToRows,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: ['2019-10-01T11:10:23Z'] },
        { name: 'temp', type: FieldType.number, values: [1] },
        { name: 'humidity', type: FieldType.number, values: [10] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: ['2019-09-01T11:10:23Z'] },
        { name: 'temp', type: FieldType.number, values: [-1] },
      ],
    });

    const seriesC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'time', type: FieldType.time, values: ['2019-11-01T11:10:23Z'] },
        { name: 'temp', type: FieldType.number, values: [2] },
        { name: 'humidity', type: FieldType.number, values: [5] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA, seriesB, seriesC]);
    const expected: Field[] = [
      createField('time', FieldType.time, ['2019-09-01T11:10:23Z', '2019-10-01T11:10:23Z', '2019-11-01T11:10:23Z']),
      createField('metric', FieldType.string, ['B-series', 'A-series', 'C-series']),
      createField('temp', FieldType.number, [-1, 1, 2]),
      createField('humidity', FieldType.number, [null, 10, 5]),
    ];

    expect(result[0].fields).toMatchObject(expected);
  });

  it('combine two classic series with multiple values into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsOptions> = {
      id: DataTransformerID.seriesToRows,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'temp', type: FieldType.number, values: [-1, 2, 3] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA, seriesB]);
    const expected: Field[] = [
      createField('time', FieldType.time, [100, 100, 125, 126, 150, 200]),
      createField('metric', FieldType.string, ['A-series', 'B-series', 'B-series', 'B-series', 'A-series', 'A-series']),
      createField('value', FieldType.number, [1, -1, 2, 3, 4, 5]),
    ];

    expect(result[0].fields).toMatchObject(expected);
  });

  it('combine three series with multiple values into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsOptions> = {
      id: DataTransformerID.seriesToRows,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'temp', type: FieldType.number, values: [1, 4, 5] },
        { name: 'humidity', type: FieldType.number, values: [10, 14, 55] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'temp', type: FieldType.number, values: [-1, 2, 3] },
      ],
    });

    const seriesC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 124, 149] },
        { name: 'humidity', type: FieldType.number, values: [22, 25, 30] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA, seriesB, seriesC]);
    const expected: Field[] = [
      createField('time', FieldType.time, [100, 100, 100, 124, 125, 126, 149, 150, 200]),
      createField('metric', FieldType.string, [
        'A-series',
        'B-series',
        'C-series',
        'C-series',
        'B-series',
        'B-series',
        'C-series',
        'A-series',
        'A-series',
      ]),
      createField('temp', FieldType.number, [1, -1, null, null, 2, 3, null, 4, 5]),
      createField('humidity', FieldType.number, [10, null, 22, 25, null, null, 30, 14, 55]),
    ];

    expect(result[0].fields).toMatchObject(expected);
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
