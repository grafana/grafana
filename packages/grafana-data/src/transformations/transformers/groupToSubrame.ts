import { map } from 'rxjs/operators';

import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, FieldType, Field } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { ReducerID, reduceField } from '../fieldReducer'; 

import { DataTransformerID } from './ids';

export enum GroupByOperationID {
  aggregate = 'aggregate',
  groupBy = 'groupby',
}

export interface GroupToSubframeFieldOptions {
  aggregations: ReducerID[];
  operation: GroupByOperationID | null;
}

export interface GroupToSubframeTransformerOptions {
  fields: Record<string, GroupToSubframeFieldOptions>;
}

interface FieldMap {
  [key: string]: Field,
}

interface GroupValue2Fields {
  [key: string]: FieldMap,
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

          // Construct a subframe of any fields
          // that aren't being group on or reduced
          const subFrames: DataFrame[][] = [];
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
                (fieldOpts.operation === null || fieldOpts.operation === undefined)
              ) {
                nestedFields.push(field);
              }
            }
            
            // If there are any values in the subfields
            // push a new subframe with the fields
            // otherwise push an empty frame
            if (nestedFields.length > 0) {
              subFrames.push([createSubframe(nestedFields, nestedFields[0].values.length)]);
            }
            else {
              subFrames.push([createSubframe([], 0)]);
            }
          }
          // At this point we have fields for each nested frame
          // However we need to turn them into frames so they can be nested 
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
          for (let i = 0; i < frame.fields.length; i++) {
            const field = frame.fields[i];
            

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

          fields.push({
            config: {},
            name: "NF",
            type: FieldType.nestedFrames,
            values: subFrames
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
    meta: { custom: { noHeader: true } },
    length: frameLength,
    fields,
  }
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
