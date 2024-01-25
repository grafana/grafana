import { map } from 'rxjs/operators';

import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, FieldType, Field } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { ReducerID, reduceField } from '../fieldReducer';

import { createGroupedFields, groupValuesByKey, GroupByFieldOptions } from './groupBy';
import { DataTransformerID } from './ids';

export enum GroupByOperationID {
  aggregate = 'aggregate',
  groupBy = 'groupby',
}

export interface GroupToSubframeFieldOptions extends GroupByFieldOptions {
  showSubtableHeaders?: boolean;
}

export interface GroupToSubframeTransformerOptions {
  fields: Record<string, GroupToSubframeFieldOptions>;
}

interface FieldMap {
  [key: string]: Field;
}

export const groupToSubframeTransformer: DataTransformerInfo<GroupToSubframeTransformerOptions> = {
  id: DataTransformerID.groupToSubframe,
  name: 'Group to Subframe',
  description: 'Group and then place in a sub-frame',
  defaultOptions: {
    fields: {},
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
            name: 'Nested frames',
            type: FieldType.nestedFrames,
            values: subFrames,
          });

          processed.push({
            fields,
            length: valuesByGroupKey.size + 1,
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
function createSubframe(fields: Field[], frameLength: number) {
  return {
    meta: { custom: { noHeader: false } },
    length: frameLength,
    fields,
  };
}

const shouldGroupOnField = (field: Field, options: GroupToSubframeTransformerOptions): boolean => {
  const fieldName = getFieldDisplayName(field);
  return options?.fields[fieldName]?.operation === GroupByOperationID.groupBy;
};

const shouldCalculateField = (field: Field, options: GroupToSubframeTransformerOptions): boolean => {
  const fieldName = getFieldDisplayName(field);
  return (
    options?.fields[fieldName]?.operation === GroupByOperationID.aggregate &&
    Array.isArray(options?.fields[fieldName].aggregations) &&
    options?.fields[fieldName].aggregations.length > 0
  );
};

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
 *
 * @param valuesByGroupKey
 * @param options
 * @returns
 */
function groupToSubframes(
  valuesByGroupKey: Map<string, FieldMap>,
  options: GroupToSubframeTransformerOptions
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
      subFrames.push([createSubframe(nestedFields, nestedFields[0].values.length)]);
    } else {
      subFrames.push([createSubframe([], 0)]);
    }
  }

  return subFrames;
}
