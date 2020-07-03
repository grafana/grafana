import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { DataTransformerConfig, Field, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe';
import { transformDataFrame } from '../transformDataFrame';
import { ArrayVector } from '../../vector';
import { seriesToRowsTransformer, SeriesToRowsTransformerOptions } from './seriesToRows';

describe('Series to rows', () => {
  beforeAll(() => {
    mockTransformationsRegistry([seriesToRowsTransformer]);
  });

  it('combine two series into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsTransformerOptions> = {
      id: DataTransformerID.seriesToRows,
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
      createField('Time', FieldType.time, [1000, 2000]),
      createField('Metric', FieldType.string, ['A', 'B']),
      createField('Value', FieldType.number, [1, -1]),
    ];

    expect(result[0].fields).toMatchObject(expected);
  });

  it('combine two series with multiple values into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsTransformerOptions> = {
      id: DataTransformerID.seriesToRows,
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
      createField('Time', FieldType.time, [100, 100, 125, 126, 150, 200]),
      createField('Metric', FieldType.string, ['A', 'B', 'B', 'B', 'A', 'A']),
      createField('Value', FieldType.number, [1, -1, 2, 3, 4, 5]),
    ];

    expect(result[0].fields).toMatchObject(expected);
  });

  it('combine three series into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsTransformerOptions> = {
      id: DataTransformerID.seriesToRows,
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
      createField('Time', FieldType.time, [500, 1000, 2000]),
      createField('Metric', FieldType.string, ['C', 'A', 'B']),
      createField('Value', FieldType.number, [2, 1, -1]),
    ];

    expect(result[0].fields).toMatchObject(expected);
  });

  it('combine two time series, where first serie fields has displayName, into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsTransformerOptions> = {
      id: DataTransformerID.seriesToRows,
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
      createField('Time', FieldType.time, [100, 100, 125, 126, 150, 200]),
      createField('Metric', FieldType.string, ['A', 'B', 'B', 'B', 'A', 'A']),
      createField('Value', FieldType.number, [1, -1, 2, 3, 4, 5]),
    ];

    expect(result[0].fields[2].config).toEqual({});
    expect(result[0].fields).toMatchObject(expected);
  });

  it('combine two time series, where first serie fields has units, into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsTransformerOptions> = {
      id: DataTransformerID.seriesToRows,
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
      createField('Time', FieldType.time, [100, 100, 125, 126, 150, 200]),
      createField('Metric', FieldType.string, ['A', 'B', 'B', 'B', 'A', 'A']),
      createField('Value', FieldType.number, [1, -1, 2, 3, 4, 5], { units: 'celsius' }),
    ];

    expect(result[0].fields[2].config).toEqual({ units: 'celsius' });
    expect(result[0].fields).toMatchObject(expected);
  });

  it('combine two time series, where second serie fields has units, into one', () => {
    const cfg: DataTransformerConfig<SeriesToRowsTransformerOptions> = {
      id: DataTransformerID.seriesToRows,
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
      createField('Time', FieldType.time, [100, 100, 125, 126, 150, 200]),
      createField('Metric', FieldType.string, ['A', 'B', 'B', 'B', 'A', 'A']),
      createField('Value', FieldType.number, [1, -1, 2, 3, 4, 5]),
    ];

    expect(result[0].fields[2].config).toEqual({});
    expect(result[0].fields).toMatchObject(expected);
  });
});

const createField = (name: string, type: FieldType, values: any[], config = {}): Field => {
  return { name, type, values: new ArrayVector(values), config, labels: undefined };
};
