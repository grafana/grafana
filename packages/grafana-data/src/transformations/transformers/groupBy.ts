import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, Field } from '../../types/dataFrame';
import { DataTransformerInfo, TransformationApplicabilityLevels } from '../../types/transformations';
import { getFieldTypeForReducer, reduceField, ReducerID } from '../fieldReducer';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { DataTransformerID } from './ids';
import { findMaxFields } from './utils';

const MINIMUM_FIELDS_REQUIRED = 2;

export enum GroupByOperationID {
  aggregate = 'aggregate',
  groupBy = 'groupby',
}

export interface GroupByFieldOptions {
  aggregations: ReducerID[];
  operation: GroupByOperationID | null;
}

export interface GroupByTransformerOptions {
  fields: Record<string, GroupByFieldOptions>;
}

interface FieldMap {
  [key: string]: Field;
}

export const groupByTransformer: DataTransformerInfo<GroupByTransformerOptions> = {
  id: DataTransformerID.groupBy,
  name: 'Group by',
  description: 'Group the data by a field values then process calculations for each group.',
  defaultOptions: {
    fields: {},
  },
  isApplicable: (data: DataFrame[]) => {
    // Group by needs at least two fields
    // a field to group on and a field to aggregate
    // We make sure that at least one frame has at
    // least two fields
    const maxFields = findMaxFields(data);

    return maxFields >= MINIMUM_FIELDS_REQUIRED
      ? TransformationApplicabilityLevels.Applicable
      : TransformationApplicabilityLevels.NotApplicable;
  },
  isApplicableDescription: (data: DataFrame[]) => {
    const maxFields = findMaxFields(data);
    return `The Group by transformation requires a series with at least ${MINIMUM_FIELDS_REQUIRED} fields to work. The maximum number of fields found on a series is ${maxFields}`;
  },
  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        const groupByFieldNames: string[] = [];

        for (const [k, v] of Object.entries(options.fields)) {
          if (v.operation === GroupByOperationID.groupBy) {
            groupByFieldNames.push(k);
          }
        }

        if (groupByFieldNames.length === 0) {
          return data;
        }

        const matcher = getFieldMatcher({
          id: FieldMatcherID.byNames,
          options: { names: groupByFieldNames },
        });

        const processed: DataFrame[] = [];

        for (const frame of data) {
          // Create a list of fields to group on
          // If there are none we skip the rest

          const groupByFields: Field[] = frame.fields.filter((field) => matcher(field, frame, data));

          if (groupByFields.length === 0) {
            continue;
          }

          // Group the values by fields and groups so we can get all values for a
          // group for a given field.
          const valuesByGroupKey = groupValuesByKey(frame, groupByFields);

          // Add the grouped fields to the resulting fields of the transformation
          const fields: Field[] = createGroupedFields(groupByFields, valuesByGroupKey);

          // Then for each calculations configured, compute and add a new field (column)
          for (const field of frame.fields) {
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
                values: valuesByAggregation[aggregation] ?? [],
                type: getFieldTypeForReducer(aggregation, field.type),
                config: {},
              };

              fields.push(aggregationField);
            }
          }

          processed.push({
            ...frame,
            fields,
            length: valuesByGroupKey.size,
          });
        }

        return processed;
      })
    ),
};

const shouldCalculateField = (field: Field, options: GroupByTransformerOptions): boolean => {
  const fieldName = getFieldDisplayName(field);
  return (
    options?.fields[fieldName]?.operation === GroupByOperationID.aggregate &&
    Array.isArray(options?.fields[fieldName].aggregations) &&
    options?.fields[fieldName].aggregations.length > 0
  );
};

/**
 * Groups values together by key. This will create a mapping of strings
 * to _FieldMaps_ that will then be used to group values on.
 *
 * @param frame
 *  The dataframe containing the data to group.
 * @param groupByFields
 *  An array of fields to group on.
 */
export function groupValuesByKey(frame: DataFrame, groupByFields: Field[]) {
  const valuesByGroupKey = new Map<string, FieldMap>();

  for (let rowIndex = 0; rowIndex < frame.length; rowIndex++) {
    const groupKey = String(groupByFields.map((field) => field.values[rowIndex]));
    const valuesByField = valuesByGroupKey.get(groupKey) ?? {};

    if (!valuesByGroupKey.has(groupKey)) {
      valuesByGroupKey.set(groupKey, valuesByField);
    }

    for (let field of frame.fields) {
      const fieldName = getFieldDisplayName(field);

      if (!valuesByField[fieldName]) {
        valuesByField[fieldName] = {
          name: fieldName,
          type: field.type,
          config: { ...field.config },
          values: [],
        };
      }

      valuesByField[fieldName].values.push(field.values[rowIndex]);
    }
  }

  return valuesByGroupKey;
}

/**
 * Create new fields which will be used to display grouped values.
 *
 * @param groupByFields
 * @param valuesByGroupKey
 * @returns
 *  Returns an array of fields that have been grouped.
 */
export function createGroupedFields(groupByFields: Field[], valuesByGroupKey: Map<string, FieldMap>): Field[] {
  const fields: Field[] = [];

  for (const field of groupByFields) {
    const values: unknown[] = [];
    const fieldName = getFieldDisplayName(field);

    valuesByGroupKey.forEach((value) => {
      values.push(value[fieldName].values[0]);
    });

    fields.push({
      name: field.name,
      type: field.type,
      config: {
        ...field.config,
      },
      values,
    });
  }

  return fields;
}
