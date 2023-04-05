import { map } from 'rxjs/operators';

import { MutableDataFrame } from '../../dataframe';
import { DataFrame, DataTransformerInfo, Field, FieldType, SpecialValue, Vector } from '../../types';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { DataTransformerID } from './ids';

export interface GroupingToMatrixTransformerOptions {
  columnField?: string;
  rowField?: string;
  valueField?: string;
  emptyValue?: SpecialValue;
}

const DEFAULT_COLUMN_FIELD = 'Time';
const DEFAULT_ROW_FIELD = 'Time';
const DEFAULT_VALUE_FIELD = 'Value';
const DEFAULT_EMPTY_VALUE = SpecialValue.Empty;

export const groupingToMatrixTransformer: DataTransformerInfo<GroupingToMatrixTransformerOptions> = {
  id: DataTransformerID.groupingToMatrix,
  name: 'Grouping to Matrix',
  description: 'Groups series by field and return a matrix visualisation',
  defaultOptions: {
    columnField: DEFAULT_COLUMN_FIELD,
    rowField: DEFAULT_ROW_FIELD,
    valueField: DEFAULT_VALUE_FIELD,
  },

  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        const columnFieldMatch = options.columnField || DEFAULT_COLUMN_FIELD;
        const rowFieldMatch = options.rowField || DEFAULT_ROW_FIELD;
        const valueFieldMatch = options.valueField || DEFAULT_VALUE_FIELD;
        const emptyValue = options.emptyValue || DEFAULT_EMPTY_VALUE;

        // Accept only single queries
        if (data.length !== 1) {
          return data;
        }

        const frame = data[0];
        const keyColumnField = findKeyField(frame, columnFieldMatch);
        const keyRowField = findKeyField(frame, rowFieldMatch);
        const valueField = findKeyField(frame, valueFieldMatch);
        const rowColumnField = `${rowFieldMatch}\\${columnFieldMatch}`;

        if (!keyColumnField || !keyRowField || !valueField) {
          return data;
        }

        const columnValues = uniqueValues(keyColumnField.values);
        const rowValues = uniqueValues(keyRowField.values);

        const matrixValues: { [key: string]: { [key: string]: any } } = {};

        for (let index = 0; index < valueField.values.length; index++) {
          const columnName = keyColumnField.values.get(index);
          const rowName = keyRowField.values.get(index);
          const value = valueField.values.get(index);

          if (!matrixValues[columnName]) {
            matrixValues[columnName] = {};
          }

          matrixValues[columnName][rowName] = value;
        }

        const resultFrame = new MutableDataFrame();

        resultFrame.addField({
          name: rowColumnField,
          values: rowValues,
          type: FieldType.string,
        });

        for (const columnName of columnValues) {
          let values = [];
          for (const rowName of rowValues) {
            const value = matrixValues[columnName][rowName] ?? getSpecialValue(emptyValue);
            values.push(value);
          }

          // setting the displayNameFromDS in prometheus overrides
          // the column name based on value fields that are numbers
          // this prevents columns that should be named 1000190
          // from becoming named {__name__: 'metricName'}
          if (typeof columnName === 'number') {
            valueField.config.displayNameFromDS = undefined;
          }

          resultFrame.addField({
            name: columnName.toString(),
            values: values,
            config: valueField.config,
            type: valueField.type,
          });
        }

        return [resultFrame];
      })
    ),
};

function uniqueValues(values: Vector): any[] {
  const unique = new Set();

  for (let index = 0; index < values.length; index++) {
    unique.add(values.get(index));
  }

  return Array.from(unique);
}

function findKeyField(frame: DataFrame, matchTitle: string): Field | null {
  for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
    const field = frame.fields[fieldIndex];

    const matcher = fieldMatchers.get(FieldMatcherID.byName).get(matchTitle);

    if (matcher(field, frame, [frame])) {
      return field;
    }
  }

  return null;
}

function getSpecialValue(specialValue: SpecialValue) {
  switch (specialValue) {
    case SpecialValue.False:
      return false;
    case SpecialValue.True:
      return true;
    case SpecialValue.Null:
      return null;
    case SpecialValue.Empty:
    default:
      return '';
  }
}
