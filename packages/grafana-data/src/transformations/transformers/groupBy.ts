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
  fieldName: string | null;
  aggregations: ReducerID[];
  operation: GroupByOperationID;
}

export interface GroupByTransformerOptions {
  fieldsArray: GroupByFieldOptions[];
}

export const groupByTransformer: DataTransformerInfo<GroupByTransformerOptions> = {
  id: DataTransformerID.groupBy,
  name: 'Group By',
  description: 'Group the data by a field values then process calculations for each group',
  defaultOptions: {
    fieldsArray: [],
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: GroupByTransformerOptions) => {
    const calculationsByField = options.fieldsArray.filter(val => val.operation === GroupByOperationID.aggregate);
    const groupByFieldNames = options.fieldsArray
      .filter(val => val.operation === GroupByOperationID.groupBy)
      .map(val => val.fieldName);

    return (data: DataFrame[]) => {
      if (groupByFieldNames.length === 0) {
        return data;
      }

      const processed: DataFrame[] = [];

      //
      // First, group the data in a way we can easily work with
      //

      for (let frame of data) {
        // Get all the GroupBy fields and put them in the same array
        const groupByFields: Field[] = [];
        for (let fieldName of groupByFieldNames) {
          for (let field of frame.fields) {
            if (getFieldDisplayName(field) === fieldName) {
              groupByFields.push(field);
            }
          }
        }

        if (groupByFields.length === 0) {
          continue; // No group by field in this frame, ignore the frame
        }

        /*
         Group together the data (the rows) that have the same values for the GroupBy fields
         We do that by creating a Map() in which the key will represent the GroupBy values and the object will contain the rows that have this data
         
         Something like this :
        
          {
            ["goupByField1Value1","groupByField2Value1", ...] : {fieldName1:Field, fieldname2:Field, ...},
            ["goupByField1Value2","groupByField2Value2", ...] : {fieldName1:Field, fieldname2:Field, ...},
            ["goupByField1Value3","groupByField2Value3", ...] : {fieldName1:Field, fieldname2:Field, ...},
            ...
          }
        */

        const groupedData: Record<string, Record<string, MutableField>> = {};
        for (let rowIndex = 0; rowIndex < frame.length; rowIndex++) {
          let key = String(groupByFields.map(field => field.values.get(rowIndex)));

          let rowDataByField = groupedData[key];
          if (!rowDataByField) {
            rowDataByField = {};
            groupedData[key] = rowDataByField;
          }

          for (let field of frame.fields) {
            const fieldName = getFieldDisplayName(field);

            if (!rowDataByField[fieldName]) {
              rowDataByField[fieldName] = {
                name: getFieldDisplayName(field),
                type: field.type,
                config: {},
                values: new ArrayVector(),
              };
            }

            rowDataByField[fieldName].values.add(field.values.get(rowIndex));
          }
        }

        //
        // Build the new frame
        //

        const fields: Field[] = []; // The fields that our new frame will contain
        const groupedDataKeys = Object.keys(groupedData);

        // Create a field (column) for each GroupBy field

        for (let field of groupByFields) {
          let values = new ArrayVector();
          let fieldName = getFieldDisplayName(field);

          for (let key of groupedDataKeys) {
            values.add(groupedData[key][fieldName].values.get(0));
          }

          let newField = {
            name: field.name,
            type: field.type,
            config: {
              ...field.config,
            },
            values: values,
          };
          fields.push(newField);
        }

        // Then for each calculations configured, compute and add a new field (column)
        const fieldList = frame.fields.map(f => getFieldDisplayName(f)); // Fields that are present in the data

        for (let element of calculationsByField) {
          if (element.fieldName === null || !fieldList.includes(element.fieldName)) {
            continue;
          }

          // This won't be so intuitive as way to build the result, but if we want to take advantage
          // of the reduceField function, we'll have to loop on the data this way. We will build a few
          // fields (columns) at the time, corresponding the each field we want to make some calculations on.

          let calculationResults: Record<string, any[]> = {};
          for (let calc of element.aggregations) {
            calculationResults[calc] = [];
          }

          // The we need to loop on each group of values to get the result and append each
          // result to the new fields
          let fieldType = null;
          for (let val of groupedDataKeys) {
            let field = groupedData[val][element.fieldName];
            fieldType = field.type;

            // reduceField will return an object will all the calculations from the specified list, possibly more
            let results = reduceField({
              field,
              reducers: element.aggregations,
            });

            for (let calc of element.aggregations) {
              calculationResults[calc].push(results[calc]);
            }
          }

          // Now we add the fields to the new fields
          for (let calc of element.aggregations) {
            let f = {
              name: element.fieldName + ' (' + calc + ')',
              values: new ArrayVector(calculationResults[calc]),
              type: FieldType.other,
              config: {},
            };

            if ([ReducerID.allIsNull, ReducerID.allIsNull].includes(calc)) {
              f.type = FieldType.boolean;
            } else if (
              [ReducerID.last, ReducerID.lastNotNull, ReducerID.first, ReducerID.firstNotNull].includes(calc) &&
              fieldType
            ) {
              f.type = fieldType; // Keep same field type (useful for time field type mainly, so it displays properly as time, not as a number)
            } else {
              f.type = guessFieldTypeForField(f) ?? FieldType.string;
            }

            fields.push(f);
          }
        }

        processed.push({
          fields,
          length: groupedDataKeys.length,
        });
      }

      return processed;
    };
  },
};
