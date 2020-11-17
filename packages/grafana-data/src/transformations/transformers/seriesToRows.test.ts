import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { DataTransformerConfig, Field, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe';
import { transformDataFrame } from '../transformDataFrame';
import { ArrayVector } from '../../vector';
import { seriesToRowsTransformer, SeriesToRowsTransformerOptions } from './seriesToRows';
import { observableTester } from '../../utils/tests/observableTester';

describe('Series to rows', () => {
  beforeAll(() => {
    mockTransformationsRegistry([seriesToRowsTransformer]);
  });

  it('combine two series into one', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA, seriesB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [2000, 1000]),
          createField('Metric', FieldType.string, ['B', 'A']),
          createField('Value', FieldType.number, [-1, 1]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine two series with multiple values into one', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA, seriesB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [200, 150, 126, 125, 100, 100]),
          createField('Metric', FieldType.string, ['A', 'A', 'B', 'B', 'A', 'B']),
          createField('Value', FieldType.number, [5, 4, 3, 2, 1, -1]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine three series into one', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA, seriesB, seriesC]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [2000, 1000, 500]),
          createField('Metric', FieldType.string, ['B', 'A', 'C']),
          createField('Value', FieldType.number, [-1, 1, 2]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine two time series, where first serie fields has displayName, into one', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [serieA, serieB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [200, 150, 126, 125, 100, 100]),
          createField('Metric', FieldType.string, ['A', 'A', 'B', 'B', 'A', 'B']),
          createField('Value', FieldType.number, [5, 4, 3, 2, 1, -1]),
        ];

        const fields = unwrap(result[0].fields);

        expect(fields[2].config).toEqual({});
        expect(fields).toEqual(expected);
      },
      done,
    });
  });

  it('combine two time series, where first serie fields has units, into one', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [serieA, serieB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [200, 150, 126, 125, 100, 100]),
          createField('Metric', FieldType.string, ['A', 'A', 'B', 'B', 'A', 'B']),
          createField('Value', FieldType.number, [5, 4, 3, 2, 1, -1], { units: 'celsius' }),
        ];

        const fields = unwrap(result[0].fields);

        expect(fields[2].config).toEqual({ units: 'celsius' });
        expect(fields).toEqual(expected);
      },
      done,
    });
  });

  it('combine two time series, where second serie fields has units, into one', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [serieA, serieB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [200, 150, 126, 125, 100, 100]),
          createField('Metric', FieldType.string, ['A', 'A', 'B', 'B', 'A', 'B']),
          createField('Value', FieldType.number, [5, 4, 3, 2, 1, -1]),
        ];

        const fields = unwrap(result[0].fields);

        expect(fields[2].config).toEqual({});
        expect(fields).toEqual(expected);
      },
      done,
    });
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
