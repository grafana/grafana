import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { DataTransformerConfig, Field, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe';
import { transformDataFrame } from '../transformDataFrame';
import { ArrayVector } from '../../vector';
import { mergeTransformer, MergeTransformerOptions } from './merge';

describe('Merge multipe to single', () => {
  beforeAll(() => {
    mockTransformationsRegistry([mergeTransformer]);
  });

  it('combine two series into one', () => {
    const cfg: DataTransformerConfig<MergeTransformerOptions> = {
      id: DataTransformerID.merge,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Temp', type: FieldType.number, values: [1] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [2000] },
        { name: 'Temp', type: FieldType.number, values: [-1] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA, seriesB]);
    const expected: Field[] = [
      createField('Time', FieldType.time, [2000, 1000]),
      createField('Temp', FieldType.number, [-1, 1]),
    ];

    expect(unwrap(result[0].fields)).toEqual(expected);
  });

  it('combine two series with multiple values into one', () => {
    const cfg: DataTransformerConfig<MergeTransformerOptions> = {
      id: DataTransformerID.merge,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA, seriesB]);
    const expected: Field[] = [
      createField('Time', FieldType.time, [200, 150, 126, 125, 100, 100]),
      createField('Temp', FieldType.number, [5, 4, 3, 2, 1, -1]),
    ];

    expect(unwrap(result[0].fields)).toEqual(expected);
  });

  it('combine three series into one', () => {
    const cfg: DataTransformerConfig<MergeTransformerOptions> = {
      id: DataTransformerID.merge,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Temp', type: FieldType.number, values: [1] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [2000] },
        { name: 'Temp', type: FieldType.number, values: [-1] },
      ],
    });

    const seriesC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Time', type: FieldType.time, values: [500] },
        { name: 'Temp', type: FieldType.number, values: [2] },
      ],
    });

    const result = transformDataFrame([cfg], [seriesA, seriesB, seriesC]);
    const expected: Field[] = [
      createField('Time', FieldType.time, [2000, 1000, 500]),
      createField('Temp', FieldType.number, [-1, 1, 2]),
    ];

    expect(unwrap(result[0].fields)).toEqual(expected);
  });

  it('combine one serie and two tables into one table', () => {
    const cfg: DataTransformerConfig<MergeTransformerOptions> = {
      id: DataTransformerID.merge,
      options: {},
    };

    const tableA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Temp', type: FieldType.number, values: [1] },
        { name: 'Humidity', type: FieldType.number, values: [10] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Temp', type: FieldType.number, values: [-1] },
      ],
    });

    const tableB = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Time', type: FieldType.time, values: [500] },
        { name: 'Temp', type: FieldType.number, values: [2] },
        { name: 'Humidity', type: FieldType.number, values: [5] },
      ],
    });

    const result = transformDataFrame([cfg], [tableA, seriesB, tableB]);
    const expected: Field[] = [
      createField('Time', FieldType.time, [1000, 1000, 500]),
      createField('Temp', FieldType.number, [1, -1, 2]),
      createField('Humidity', FieldType.number, [10, null, 5]),
    ];

    expect(unwrap(result[0].fields)).toEqual(expected);
  });

  it('combine one serie and two tables with ISO dates into one table', () => {
    const cfg: DataTransformerConfig<MergeTransformerOptions> = {
      id: DataTransformerID.merge,
      options: {},
    };

    const tableA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: ['2019-10-01T11:10:23Z'] },
        { name: 'Temp', type: FieldType.number, values: [1] },
        { name: 'Humidity', type: FieldType.number, values: [10] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: ['2019-09-01T11:10:23Z'] },
        { name: 'Temp', type: FieldType.number, values: [-1] },
      ],
    });

    const tableC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Time', type: FieldType.time, values: ['2019-11-01T11:10:23Z'] },
        { name: 'Temp', type: FieldType.number, values: [2] },
        { name: 'Humidity', type: FieldType.number, values: [5] },
      ],
    });

    const result = transformDataFrame([cfg], [tableA, seriesB, tableC]);
    const expected: Field[] = [
      createField('Time', FieldType.time, ['2019-11-01T11:10:23Z', '2019-10-01T11:10:23Z', '2019-09-01T11:10:23Z']),
      createField('Temp', FieldType.number, [2, 1, -1]),
      createField('Humidity', FieldType.number, [5, 10, null]),
    ];

    expect(unwrap(result[0].fields)).toEqual(expected);
  });

  it('combine three tables with multiple values into one', () => {
    const cfg: DataTransformerConfig<MergeTransformerOptions> = {
      id: DataTransformerID.merge,
      options: {},
    };

    const tableA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
        { name: 'Humidity', type: FieldType.number, values: [10, 14, 55] },
      ],
    });

    const tableB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3] },
        { name: 'Enabled', type: FieldType.boolean, values: [true, false, true] },
      ],
    });

    const tableC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 124, 149] },
        { name: 'Humidity', type: FieldType.number, values: [22, 25, 30] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    const result = transformDataFrame([cfg], [tableA, tableB, tableC]);

    const expected: Field[] = [
      createField('Time', FieldType.time, [200, 150, 149, 126, 125, 124, 100, 100, 100]),
      createField('Temp', FieldType.number, [5, 4, 5, 3, 2, 4, 1, -1, 1]),
      createField('Humidity', FieldType.number, [55, 14, 30, null, null, 25, 10, null, 22]),
      createField('Enabled', FieldType.boolean, [null, null, null, true, false, null, null, true, null]),
    ];

    expect(unwrap(result[0].fields)).toEqual(expected);
  });

  it('combine two time series, where first serie fields has displayName, into one', () => {
    const cfg: DataTransformerConfig<MergeTransformerOptions> = {
      id: DataTransformerID.merge,
      options: {},
    };

    const serieA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200], config: { displayName: 'Random time' } },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5], config: { displayName: 'Temp' } },
      ],
    });

    const serieB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3] },
      ],
    });

    const result = transformDataFrame([cfg], [serieA, serieB]);
    const expected: Field[] = [
      createField('Time', FieldType.time, [200, 150, 126, 125, 100, 100]),
      createField('Temp', FieldType.number, [5, 4, 3, 2, 1, -1]),
    ];

    const fields = unwrap(result[0].fields);

    expect(fields[1].config).toEqual({});
    expect(fields).toEqual(expected);
  });

  it('combine two time series, where first serie fields has units, into one', () => {
    const cfg: DataTransformerConfig<MergeTransformerOptions> = {
      id: DataTransformerID.merge,
      options: {},
    };

    const serieA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5], config: { units: 'celsius' } },
      ],
    });

    const serieB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3] },
      ],
    });

    const result = transformDataFrame([cfg], [serieA, serieB]);
    const expected: Field[] = [
      createField('Time', FieldType.time, [200, 150, 126, 125, 100, 100]),
      createField('Temp', FieldType.number, [5, 4, 3, 2, 1, -1], { units: 'celsius' }),
    ];

    const fields = unwrap(result[0].fields);

    expect(fields[1].config).toEqual({ units: 'celsius' });
    expect(fields).toEqual(expected);
  });

  it('combine two time series, where second serie fields has units, into one', () => {
    const cfg: DataTransformerConfig<MergeTransformerOptions> = {
      id: DataTransformerID.merge,
      options: {},
    };

    const serieA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    const serieB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3], config: { units: 'celsius' } },
      ],
    });

    const result = transformDataFrame([cfg], [serieA, serieB]);
    const expected: Field[] = [
      createField('Time', FieldType.time, [200, 150, 126, 125, 100, 100]),
      createField('Temp', FieldType.number, [5, 4, 3, 2, 1, -1]),
    ];

    const fields = unwrap(result[0].fields);

    expect(fields[1].config).toEqual({});
    expect(fields).toEqual(expected);
  });
});

const createField = (name: string, type: FieldType, values: any[], config = {}): Field => {
  return { name, type, values: new ArrayVector(values), config, labels: undefined };
};

const unwrap = (fields: Field[]): Field[] => {
  return fields.map(field =>
    createField(
      field.name,
      field.type,
      field.values.toArray().map((value: any) => value),
      field.config
    )
  );
};
