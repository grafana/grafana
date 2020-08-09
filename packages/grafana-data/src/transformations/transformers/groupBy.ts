import { DataTransformerID } from './ids';
import { DataFrame, FieldType, Field } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { getFieldDisplayName } from '../../field/fieldState';
import { ArrayVector } from '../../vector/ArrayVector';
import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { reduceField, ReducerID } from '../fieldReducer';

export interface GroupByTransformerOptions {
  byField: string | null;
  calculationsByField: Array<[string | null, ReducerID[]]>;
}

export const groupByTransformer: DataTransformerInfo<GroupByTransformerOptions> = {
  id: DataTransformerID.groupBy,
  name: 'Group By',
  description: 'Group the data by a field values then process calculations for each group',
  defaultOptions: {
    calculationsByField: [],
    byField: null,
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: GroupByTransformerOptions) => {
    const groupByFieldName = options.byField || '';
    const calculationsByField = options.calculationsByField; //.map((val, index) => ({fieldName: val[0], calculations: val[1]}));

    return (data: DataFrame[]) => {
      const processed: DataFrame[] = [];

      //
      // First, group the data in a way we can easily work with
      //

      /*
        Something like this:
        {
          "value1": {fieldName1:Field, fieldname2:Field},
          "value2": {fieldName1:Field, fieldname2:Field},
          "value3": {fieldName1:Field, fieldname2:Field},
          ...
        }

        where "value1", "value2", ... are the GroupBy field values
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
              rowDataByField[fieldName] = {
                name: getFieldDisplayName(field),
                type: field.type,
                config: {},
                values: [],
              };
            }

            rowDataByField[fieldName].values.push(field.values.get(rowIndex));
          }
        }

        //
        // Create the field (column) for the GroupBy field
        //

        const fields: Field[] = [];
        const groupByValues = [...groupedData.keys()];
        let mainField = {
          name: groupByField.name,
          type: groupByField.type,
          values: new ArrayVector(groupByValues),
          config: {
            ...groupByField.config,
          },
        };

        fields.push(mainField);

        //
        // Then for each calculations configured, compute and add a new field (column)
        //

        let fieldList = frame.fields.map(f => getFieldDisplayName(f)); // Fields that are present in the data

        for (let [fieldName, calculations] of calculationsByField) {
          if (fieldName === null || fieldName === groupByFieldName || !fieldList.includes(fieldName)) {
            continue;
          }

          // This won't be so intuitive as way to build the result, but if we want to take advantage
          // of the reduceField function, we'll have to loop on the data this way. We will build a few
          // fields (columns) at the time, corresponding the each field we want to make some calculations on.

          let calculationResults: Record<string, any[]> = {};
          for (let calc of calculations) {
            calculationResults[calc] = [];
          }

          // The we need to loop on each group of values to get the result and append each
          // result to the new fields
          for (let val of groupByValues) {
            let d = groupedData.get(val)[fieldName];

            // We need a field object to call reduceField
            let field: Field = {
              ...d,
              values: new ArrayVector(d.values),
            };

            // reduceField will return an object will all the calculations from the specified list, possibly more
            let results = reduceField({
              field,
              reducers: calculations,
            });

            for (let calc of calculations) {
              calculationResults[calc].push(results[calc]);
            }
          }

          // Now we add the fields to the new fields
          for (let calc of calculations) {
            let f = {
              name: fieldName + ' (' + calc + ')',
              values: new ArrayVector(calculationResults[calc]),
              type: FieldType.other,
              config: {},
            };

            f.type = guessFieldTypeForField(f) ?? FieldType.string;
            fields.push(f);
          }
        }

        processed.push({
          fields,
          length: groupByValues.length,
        });
      }

      return processed;
    };
  },
};
