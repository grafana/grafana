import { DataTransformerID } from './ids';
import { DataFrame, FieldType, Field } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';
import { getFieldDisplayName } from '../../field/fieldState';
import { ArrayVector } from '../../vector/ArrayVector';
import { guessFieldTypeForField } from '../../dataframe/processDataFrame';

export interface OccurrencesTransformerOptions {
  byField?: string;
}

export const occurrencesTransformer: DataTransformerInfo<OccurrencesTransformerOptions> = {
  id: DataTransformerID.occurrences,
  name: 'Number of Occurrences',
  description: 'Calculates the number of occurrences of each value for a specified field',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: OccurrencesTransformerOptions) => {
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

      console.log('data', data);
      console.log('processed', processed);
      return processed;
    };
  },
};
