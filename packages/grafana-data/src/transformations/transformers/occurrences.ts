import { DataTransformerID } from './ids';
import { DataFrame, FieldType, Field } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { getFieldDisplayName } from '../../field/fieldState';
import { ArrayVector } from '../../vector/ArrayVector';
import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { /*fieldReducers, reduceField,*/ ReducerID } from '../fieldReducer';

export interface OccurrencesTransformerOptions {
  byField?: string;
  reducers: ReducerID[];
  calculationsByField: Array<[string | null, ReducerID[]]>;
}

export const occurrencesTransformer: DataTransformerInfo<OccurrencesTransformerOptions> = {
  id: DataTransformerID.occurrences,
  name: 'Number of Occurrences',
  description: 'Calculates the number of occurrences of each value for a specified field',
  defaultOptions: {
    calculationsByField: [[null, [ReducerID.count]]],
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: OccurrencesTransformerOptions) => {
    console.log('options:', options);
    const groupByFieldName = options.byField || '';
    const calculationsByField = options.calculationsByField; //.map((val, index) => ({fieldName: val[0], calculations: val[1]}));

    console.log('calculationsByField:', calculationsByField);

    return (data: DataFrame[]) => {
      const processed: DataFrame[] = [];

      //
      // First, group the data in a way we can easily work with
      //

      /*
        Something like this:
        {
          "value1": {fieldName1:[values], fieldname2:[values]},
          "value2": {fieldName1:[values], fieldname2:[values]},
          "value3": {fieldName1:[values], fieldname2:[values]},
          ...
        }
      */

      for (let frame of data) {
        const groupedData = new Map(); // Using map because its key supports multiple format unlike objects
        let groupByField = null;
        for (let field of frame.fields) {
          if (getFieldDisplayName(field) === groupByFieldName) {
            groupByField = field;
            break;
          }
        }

        if (groupByField === null) {
          continue; // No group by field in this frame, ignore frame
        }

        for (let rowIndex = 0; rowIndex < groupByField.values.length; rowIndex++) {
          const value = groupByField.values.get(rowIndex);

          let rowDataByField = groupedData.get(value);
          if (!rowDataByField) {
            rowDataByField = {};
            groupedData.set(value, rowDataByField);
          }

          for (let field of frame.fields) {
            if (field === groupByField) {
              continue;
            }

            const fieldName = getFieldDisplayName(field);

            if (!rowDataByField[fieldName]) {
              rowDataByField[fieldName] = [];
            }

            rowDataByField[fieldName].push(field.values.get(rowIndex));
          }
          // console.log('groupedData', groupedData);
        }

        //
        // Create the field (column) for the GroupBy field
        //

        const fields: Field[] = [];
        const groupByValues = [...groupedData.keys()];
        console.log('groupByValues', groupByValues);
        let mainField = {
          name: groupByField.name,
          type: groupByField.type,
          values: new ArrayVector(groupByValues),
          config: {
            ...groupByField.config,
          },
        };

        console.log('mainField', mainField);
        fields.push(mainField);

        //
        // Then for each calculations configured, compute and add a new field (column)
        //

        for (let [fieldName, calculations] of calculationsByField) {
          if (fieldName === null) {
            continue;
          }

          console.log('fieldName', fieldName);

          for (let calc of calculations) {
            let values = [];

            // Process to this calculation for each grouped value
            for (let val of groupByValues) {
              let d = groupedData.get(val); //.get(fieldName);

              console.log('d', d);

              let result = 0; // Reduce

              values.push(result);
            }

            fields.push({
              name: fieldName + ' (' + calc + ')',
              type: FieldType.other, // TODO : guess type or take type from reduce function
              values: new ArrayVector(values),
            });
          }
        }

        processed.push({
          fields,
          length: groupByValues.length,
        });
      }

      console.log('processed', processed);

      return processed;
    };

    /*
    const keyFieldMatch = options.byField || '';
    let keyField: any = null;
    return (data: DataFrame[]) => {
      const processed: DataFrame[] = [];
      const fields: Field[] = [];
      const occurrences = new Map();

      for (let frame of data) {
        for (let field of frame.fields) {
          if (getFieldDisplayName(field) === keyFieldMatch) {
            if (!keyField) {
              keyField = field;
            }

            for (let value of ((field.values as unknown) as ArrayVector).buffer) {
              occurrences.set(value, (occurrences.get(value) || 0) + 1); // Increment count
            }
            break; // There should be no other field with the same name in this frame
          }
        }
      }

      if (occurrences.size === 0) {
        return data;
      }

      // Create new data frame from compiled occurrence counts
      // Two fields : value and occurences count
      const values: ArrayVector[] = [];
      const counts: ArrayVector[] = [];
      for (let [value, count] of occurrences) {
        // Add a new field value
        values.push(value);
        counts.push(count);
      }

      fields.push({
        name: keyFieldMatch,
        type: keyField ? keyField.type || FieldType.other : FieldType.other,
        values: new ArrayVector(values),
        config: {
          displayName: keyFieldMatch,
        },
      });

      // Not sure this is actually useful
      if (fields[0].type === FieldType.other) {
        let t = guessFieldTypeForField(fields[0]);
        if (t) {
          fields[0].type = keyField.type;
        }
      }

      fields.push({
        name: 'count',
        type: FieldType.number,
        values: new ArrayVector(counts),
        config: {
          displayName: 'Number of Occurrences',
        },
      });

      processed.push({
        fields,
        length: values.length,
      });

      return processed;
    };
    //*/
  },
};
