import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { DataTransformerConfig, Field, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe';
import { transformDataFrame } from '../transformDataFrame';
import { ArrayVector } from '../../vector';
import { groupingToMatrixTransformer, GroupingToMatrixTransformerOptions } from './groupingToMatrix';
import { observableTester } from '../../utils/tests/observableTester';

describe('Grouping to Matrix', () => {
  beforeAll(() => {
    mockTransformationsRegistry([groupingToMatrixTransformer]);
  });

  it('generate Matrix with default fields', done => {
    const cfg: DataTransformerConfig<GroupingToMatrixTransformerOptions> = {
      id: DataTransformerID.groupingToMatrix,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1001, 1002] },
        { name: 'Value', type: FieldType.number, values: [1, 2, 3] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA]),
      expect: result => {
        const expected: Field[] = [
          createField('Time\\Time', FieldType.string, [1000, 1001, 1002]),
          createField('1000', FieldType.number, [1, '', '']),
          createField('1001', FieldType.number, ['', 2, '']),
          createField('1002', FieldType.number, ['', '', 3]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('generate Matrix with multiple fields', done => {
    const cfg: DataTransformerConfig<GroupingToMatrixTransformerOptions> = {
      id: DataTransformerID.groupingToMatrix,
      options: {
        columnField: 'Column',
        rowField: 'Row',
        valueField: 'Temp',
      },
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Column', type: FieldType.string, values: ['C1', 'C1', 'C2'] },
        { name: 'Row', type: FieldType.string, values: ['R1', 'R2', 'R1'] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA]),
      expect: result => {
        const expected: Field[] = [
          createField('Row\\Column', FieldType.string, ['R1', 'R2']),
          createField('C1', FieldType.number, [1, 4]),
          createField('C2', FieldType.number, [5, '']),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('generate Matrix with multiple fields and value type', done => {
    const cfg: DataTransformerConfig<GroupingToMatrixTransformerOptions> = {
      id: DataTransformerID.groupingToMatrix,
      options: {
        columnField: 'Column',
        rowField: 'Row',
        valueField: 'Temp',
      },
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Column', type: FieldType.string, values: ['C1', 'C1', 'C2'] },
        { name: 'Row', type: FieldType.string, values: ['R1', 'R2', 'R1'] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5], config: { units: 'celsius' } },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA]),
      expect: result => {
        const expected: Field[] = [
          createField('Row\\Column', FieldType.string, ['R1', 'R2']),
          createField('C1', FieldType.number, [1, 4], { units: 'celsius' }),
          createField('C2', FieldType.number, [5, ''], { units: 'celsius' }),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
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
