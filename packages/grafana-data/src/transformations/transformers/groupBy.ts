import { DataTransformerID } from './ids';
import { DataFrame, FieldType, Field } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { getFieldDisplayName } from '../../field/fieldState';
import { ArrayVector } from '../../vector/ArrayVector';
import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { reduceField, ReducerID } from '../fieldReducer';
import { MutableField } from '../../dataframe/MutableDataFrame';

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

export const groupByTransformer: DataTransformerInfo<GroupByTransformerOptions> = {
  id: DataTransformerID.groupBy,
  name: 'Group by',
  description: 'Group the data by a field values then process calculations for each group',
  defaultOptions: {
    fields: {},
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: GroupByTransformerOptions) => {
    const hasValidConfig = Object.keys(options.fields).find(
      name => options.fields[name].operation === GroupByOperationID.groupBy
    );

    return (data: DataFrame[]) => {
      if (!hasValidConfig) {
        return data;
      }

      const processed: DataFrame[] = [];

      for (const frame of data) {
        const groupByFields: Field[] = [];

        for (const field of frame.fields) {
          if (shouldGroupOnField(field, options)) {
            groupByFields.push(field);
          }
        }

        if (groupByFields.length === 0) {
          continue; // No group by field in this frame, ignore the frame
        }

        // Group the values by fields and groups so we can get all values for a
        // group for a given field.
        const valuesByGroupKey: Record<string, Record<string, MutableField>> = {};
        for (let rowIndex = 0; rowIndex < frame.length; rowIndex++) {
          const groupKey = String(groupByFields.map(field => field.values.get(rowIndex)));
          const valuesByField = valuesByGroupKey[groupKey] ?? {};

          if (!valuesByGroupKey[groupKey]) {
            valuesByGroupKey[groupKey] = valuesByField;
          }

          for (let field of frame.fields) {
            const fieldName = getFieldDisplayName(field);

            if (!valuesByField[fieldName]) {
              valuesByField[fieldName] = {
                name: fieldName,
                type: field.type,
                config: { ...field.config },
                values: new ArrayVector(),
              };
            }

            valuesByField[fieldName].values.add(field.values.get(rowIndex));
          }
        }

        const fields: Field[] = [];
        const groupKeys = Object.keys(valuesByGroupKey);

        for (const field of groupByFields) {
          const values = new ArrayVector();
          const fieldName = getFieldDisplayName(field);

          for (let key of groupKeys) {
            const valuesByField = valuesByGroupKey[key];
            values.add(valuesByField[fieldName].values.get(0));
          }

          fields.push({
            name: field.name,
            type: field.type,
            config: {
              ...field.config,
            },
            values: values,
          });
        }

        // Then for each calculations configured, compute and add a new field (column)
        for (const field of frame.fields) {
          if (!shouldCalculateField(field, options)) {
            continue;
          }

          const fieldName = getFieldDisplayName(field);
          const aggregations = options.fields[fieldName].aggregations;
          const valuesByAggregation: Record<string, any[]> = {};

          for (const groupKey of groupKeys) {
            const fieldWithValuesForGroup = valuesByGroupKey[groupKey][fieldName];
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
          }

          for (const aggregation of aggregations) {
            const aggregationField: Field = {
              name: `${fieldName} (${aggregation})`,
              values: new ArrayVector(valuesByAggregation[aggregation]),
              type: FieldType.other,
              config: {},
            };

            aggregationField.type = detectFieldType(aggregation, field, aggregationField);
            fields.push(aggregationField);
          }
        }

        processed.push({
          fields,
          length: groupKeys.length,
        });
      }

      return processed;
    };
  },
};

const shouldGroupOnField = (field: Field, options: GroupByTransformerOptions): boolean => {
  const fieldName = getFieldDisplayName(field);
  return options?.fields[fieldName]?.operation === GroupByOperationID.groupBy;
};

const shouldCalculateField = (field: Field, options: GroupByTransformerOptions): boolean => {
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
