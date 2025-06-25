import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, Field } from '../../types/dataFrame';
import {
  SpecialValue,
  DataTransformerInfo,
  TransformationApplicabilityLevels,
  DataTransformContext,
} from '../../types/transformations';
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

// grafana-data does not have access to runtime so we are accessing the window object
// to get access to the feature toggle
// eslint-disable-next-line
const supportDataplaneFallback = (window as any)?.grafanaBootData?.settings?.featureToggles?.dataplaneFrontendFallback;

export const groupingToMatrixTransformer: DataTransformerInfo<GroupingToMatrixTransformerOptions> = {
  id: DataTransformerID.groupingToMatrix,
  name: 'Grouping to Matrix',
  description: 'Groups series by field and return a matrix visualisation',
  defaultOptions: {
    columnField: DEFAULT_COLUMN_FIELD,
    rowField: DEFAULT_ROW_FIELD,
    valueField: DEFAULT_VALUE_FIELD,
  },
  /**
   * Grouping to matrix requires at least 3 fields to work.
   */
  isApplicable: (data: DataFrame[]) => {
    let numFields = 0;

    for (const frame of data) {
      numFields += frame.fields.length;
    }

    return numFields >= 3
      ? TransformationApplicabilityLevels.Applicable
      : TransformationApplicabilityLevels.NotApplicable;
  },
  isApplicableDescription: (data: DataFrame[]) => {
    let numFields = 0;

    for (const frame of data) {
      numFields += frame.fields.length;
    }

    return `Grouping to matrix requires at least 3 fields to work. Currently there are ${numFields} fields.`;
  },
  operator: (options: GroupingToMatrixTransformerOptions, ctx: DataTransformContext) => (source) =>
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

        const matrixValues: { [key: string]: { [key: string]: unknown } } = {};

        for (let index = 0; index < valueField.values.length; index++) {
          const columnName = keyColumnField.values[index];
          const rowName = keyRowField.values[index];
          const value = valueField.values[index];

          if (!matrixValues[columnName]) {
            matrixValues[columnName] = {};
          }

          matrixValues[columnName][rowName] = value;
        }

        const fields: Field[] = [
          {
            name: rowColumnField,
            values: rowValues,
            type: keyRowField.type,
            config: {},
          },
        ];

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
          if (supportDataplaneFallback && typeof columnName === 'number') {
            valueField.config = { ...valueField.config, displayNameFromDS: undefined };
          }

          // the names of these columns need to be the selected column values, and not be overridden with the display name
          delete valueField.config.displayName;

          fields.push({
            name: columnName?.toString() ?? null,
            values: values,
            config: valueField.config,
            type: valueField.type,
          });
        }

        return [
          {
            fields,
            length: rowValues.length,
          },
        ];
      })
    ),
};

function uniqueValues<T>(values: T[]): T[] {
  const unique = new Set<T>(values);
  return Array.from(unique);
}

function findKeyField(frame: DataFrame, matchTitle: string): Field | null {
  for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
    const field = frame.fields[fieldIndex];

    // support for dataplane contract with Prometheus and change in location of field name
    let matches: boolean;
    if (supportDataplaneFallback) {
      const matcher = fieldMatchers.get(FieldMatcherID.byName).get(matchTitle);
      matches = matcher(field, frame, [frame]);
    } else {
      matches = matchTitle === getFieldDisplayName(field);
    }

    if (matches) {
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
    case SpecialValue.Zero:
      return 0;
    case SpecialValue.Empty:
    default:
      return '';
  }
}
