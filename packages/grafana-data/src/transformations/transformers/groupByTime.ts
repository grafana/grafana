import moment from 'moment';
import { map } from 'rxjs/operators';

import { MutableField } from '../../dataframe/MutableDataFrame';
import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { reduceField, ReducerID } from '../fieldReducer';

import { DataTransformerID } from './ids';

export enum GroupByOperationID {
  aggregate = 'aggregate',
  groupBy = 'groupby',
}

export enum GroupByTimeBucket {
    day = 'YYYY-MM-DD',
    month = 'YYYY-MM',
    year = 'YYYY',
}

export interface GroupByTimeFieldOptions {
    timeBucket?: GroupByTimeBucket | null,
    aggregations: ReducerID[];
    operation: GroupByOperationID | null;
}

export interface GroupByTimeTransformerOptions {
  fields: Record<string, GroupByTimeFieldOptions>;
}

export const groupByTimeTransformer: DataTransformerInfo<GroupByTimeTransformerOptions> = {
  id: DataTransformerID.groupByTime,
  name: 'Group by time',
  description: 'Group the data by time then process calculations for each group',
  defaultOptions: {
    fields: {},
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
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
        // Create an array of fields to group by
        // and then add configured fields to this array
          const groupByFields: Field[] = [];
          for (const field of frame.fields) {
            if (shouldGroupOnField(field, options)) {
              groupByFields.push(field);
            }
          }

          // If there are no fields to group by we do nothing
          if (groupByFields.length === 0) {
            continue; 
          }
 
          // Group the values by fields and groups so we can get all values for a
          // group for a given field.
          const valuesByGroupKey = new Map<string, Record<string, MutableField>>();
          for (let rowIndex = 0; rowIndex < frame.length; rowIndex++) {
            // Get the key for the grouping bucket for each format
            // we format using the appropriate date string to get
            // the correct grouping key
          
            const groupKey = String(groupByFields.map((field) => {
                const fieldName = getFieldDisplayName(field);
                const format = options.fields[fieldName].timeBucket?.toString();
                const date = moment(field.values[rowIndex]);

                return date.isValid() ? date.format(format) : null;
            }));

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

          const fields: Field[] = [];

          for (const field of groupByFields) {
            const values: any[] = [];
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

          processed.push({
            fields,
            length: valuesByGroupKey.size,
          });
        }

        return processed;
      })
    ),
};

const shouldGroupOnField = (field: Field, options: GroupByTimeTransformerOptions): boolean => {
  const fieldName = getFieldDisplayName(field);
  return (
    options?.fields[fieldName]?.operation === GroupByOperationID.groupBy && 
    options?.fields[fieldName]?.timeBucket !== null
  );
};

const shouldCalculateField = (field: Field, options: GroupByTimeTransformerOptions): boolean => {
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
