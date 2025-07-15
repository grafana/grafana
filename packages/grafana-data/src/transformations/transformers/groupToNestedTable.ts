import { map } from 'rxjs/operators';

import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo, TransformationApplicabilityLevels } from '../../types/transformations';
import { ReducerID, reduceField } from '../fieldReducer';

import { GroupByFieldOptions, createGroupedFields, groupValuesByKey } from './groupBy';
import { DataTransformerID } from './ids';
import { findMaxFields } from './utils';

export const SHOW_NESTED_HEADERS_DEFAULT = true;
const MINIMUM_FIELDS_REQUIRED = 2;

enum GroupByOperationID {
  aggregate = 'aggregate',
  groupBy = 'groupby',
}

export interface GroupToNestedTableTransformerOptions {
  showSubframeHeaders?: boolean;
  fields: Record<string, GroupByFieldOptions>;
}

interface FieldMap {
  [key: string]: Field;
}

export const groupToNestedTable: DataTransformerInfo<GroupToNestedTableTransformerOptions> = {
  id: DataTransformerID.groupToNestedTable,
  name: 'Group to nested tables',
  description: 'Group data by a field value and create nested tables with the grouped data',
  defaultOptions: {
    showSubframeHeaders: SHOW_NESTED_HEADERS_DEFAULT,
    fields: {},
  },
  isApplicable: (data) => {
    // Group to nested table needs at least two fields
    // a field to group on and to show in the nested table
    const maxFields = findMaxFields(data);

    return maxFields >= MINIMUM_FIELDS_REQUIRED
      ? TransformationApplicabilityLevels.Applicable
      : TransformationApplicabilityLevels.NotApplicable;
  },
  isApplicableDescription: (data: DataFrame[]) => {
    const maxFields = findMaxFields(data);
    return `The Group to nested table transformation requires a series with at least ${MINIMUM_FIELDS_REQUIRED} fields to work. The maximum number of fields found on a series is ${maxFields}`;
  },
  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        const hasValidConfig = Object.keys(options.fields).find(
          (name) => options.fields[name].operation === GroupByOperationID.groupBy
        );
        if (!hasValidConfig) {
          return data;
        }

        const processed: DataFrame[] = [];

        for (const frame of data) {
          // Create a list of fields to group on
          // If there are none we skip the rest
          const groupByFields: Field[] = frame.fields.filter((field) => shouldGroupOnField(field, options));
          if (groupByFields.length === 0) {
            continue;
          }

          // Group the values by fields and groups so we can get all values for a
          // group for a given field.
          const valuesByGroupKey = groupValuesByKey(frame, groupByFields);

          // Add the grouped fields to the resulting fields of the transformation
          const fields: Field[] = createGroupedFields(groupByFields, valuesByGroupKey);

          // Group data into sub frames so they will display as tables
          const subFrames: DataFrame[][] = groupToSubframes(valuesByGroupKey, options);

          // Then for each calculations configured, compute and add a new field (column)
          for (let i = 0; i < frame.fields.length; i++) {
            const field = frame.fields[i];

            if (!shouldCalculateField(field, options)) {
              continue;
            }

            const fieldName = getFieldDisplayName(field);
            const aggregations = options.fields[fieldName].aggregations;
            const valuesByAggregation: Record<string, unknown[]> = {};

            valuesByGroupKey.forEach((value) => {
              const fieldWithValuesForGroup = value[fieldName];
              const results = reduceField({
                field: fieldWithValuesForGroup,
                reducers: aggregations,
              });

              for (const aggregation of aggregations) {
                if (!Array.isArray(valuesByAggregation[aggregation])) {
                  valuesByAggregation[aggregation] = [];
                }
                valuesByAggregation[aggregation].push(results[aggregation]);
              }
            });

            for (const aggregation of aggregations) {
              const aggregationField: Field = {
                name: `${fieldName} (${aggregation})`,
                values: valuesByAggregation[aggregation],
                type: FieldType.other,
                config: {},
              };

              aggregationField.type = detectFieldType(aggregation, field, aggregationField);
              fields.push(aggregationField);
            }
          }

          fields.push({
            config: {},
            name: '__nestedFrames',
            type: FieldType.nestedFrames,
            values: subFrames,
          });

          processed.push({
            fields,
            length: valuesByGroupKey.size,
          });
        }

        return processed;
      })
    ),
};

/**
 * Given the appropriate data, create a sub-frame
 * which can then be displayed in a sub-table.
 */
function createSubframe(fields: Field[], frameLength: number, options: GroupToNestedTableTransformerOptions) {
  const showHeaders =
    options.showSubframeHeaders === undefined ? SHOW_NESTED_HEADERS_DEFAULT : options.showSubframeHeaders;

  return {
    meta: { custom: { noHeader: !showHeaders } },
    length: frameLength,
    fields,
  };
}

/**
 * Determines whether a field should be grouped on.
 *
 * @returns boolean
 *  This will return _true_ if a field should be grouped on and _false_ if it should not.
 */
const shouldGroupOnField = (field: Field, options: GroupToNestedTableTransformerOptions): boolean => {
  const fieldName = getFieldDisplayName(field);
  return options?.fields[fieldName]?.operation === GroupByOperationID.groupBy;
};

/**
 * Determines whether field aggregations should be calculated
 * @returns boolean
 *  This will return _true_ if a field should be calculated and _false_ if it should not.
 */
const shouldCalculateField = (field: Field, options: GroupToNestedTableTransformerOptions): boolean => {
  const fieldName = getFieldDisplayName(field);
  return (
    options?.fields[fieldName]?.operation === GroupByOperationID.aggregate &&
    Array.isArray(options?.fields[fieldName].aggregations) &&
    options?.fields[fieldName].aggregations.length > 0
  );
};

/**
 * Detect the type of field given the relevant aggregation.
 */
const detectFieldType = (aggregation: string, sourceField: Field, targetField: Field): FieldType => {
  switch (aggregation) {
    case ReducerID.allIsNull:
      return FieldType.boolean;
    case ReducerID.last:
    case ReducerID.lastNotNull:
    case ReducerID.first:
    case ReducerID.firstNotNull:
      return sourceField.type;
    default:
      return guessFieldTypeForField(targetField) ?? FieldType.string;
  }
};

/**
 * Group values into subframes so that they'll be displayed
 * inside of a subtable.
 *
 * @param valuesByGroupKey
 *  A mapping of group keys to their respective grouped values.
 * @param options
 *   Transformation options, which are used to find ungrouped/unaggregated fields.
 * @returns
 */
function groupToSubframes(
  valuesByGroupKey: Map<string, FieldMap>,
  options: GroupToNestedTableTransformerOptions
): DataFrame[][] {
  const subFrames: DataFrame[][] = [];

  // Construct a subframe of any fields
  // that aren't being group on or reduced
  for (const [, value] of valuesByGroupKey) {
    const nestedFields: Field[] = [];

    for (const [fieldName, field] of Object.entries(value)) {
      const fieldOpts = options.fields[fieldName];

      if (fieldOpts === undefined) {
        nestedFields.push(field);
      }
      // Depending on the configuration form state all of the following are possible
      else if (
        fieldOpts.aggregations === undefined ||
        (fieldOpts.operation === GroupByOperationID.aggregate && fieldOpts.aggregations.length === 0) ||
        fieldOpts.operation === null ||
        fieldOpts.operation === undefined
      ) {
        nestedFields.push(field);
      }
    }

    // If there are any values in the subfields
    // push a new subframe with the fields
    // otherwise push an empty frame
    if (nestedFields.length > 0) {
      subFrames.push([createSubframe(nestedFields, nestedFields[0].values.length, options)]);
    } else {
      subFrames.push([createSubframe([], 0, options)]);
    }
  }

  return subFrames;
}
