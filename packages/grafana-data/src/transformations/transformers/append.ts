import { map } from 'rxjs/operators';

import { DataTransformerID } from './ids';
import { MutableDataFrame } from '../../dataframe/MutableDataFrame';
import { DataTransformerInfo } from '../../types/transformations';

export interface AppendOptions {}

export const appendTransformer: DataTransformerInfo<AppendOptions> = {
  id: DataTransformerID.append,
  name: 'Append',
  description: 'Append values into a single DataFrame.  This uses the name as the key',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  operator: options => source =>
    source.pipe(
      map(data => {
        if (data.length < 2) {
          return data;
        }

        // Add the first row
        const processed = new MutableDataFrame();
        for (const f of data[0].fields) {
          processed.addField({
            ...f,
            values: [...f.values.toArray()],
          });
        }

        for (let i = 1; i < data.length; i++) {
          const frame = data[i];
          const startLength = frame.length;
          for (let j = 0; j < frame.fields.length; j++) {
            const src = frame.fields[j];
            let vals = processed.values[src.name];
            if (!vals) {
              vals = processed.addField(
                {
                  ...src,
                  values: [],
                },
                startLength
              ).values;
            }

            // Add each row
            for (let k = 0; k < frame.length; k++) {
              vals.add(src.values.get(k));
            }
          }
          processed.validate();
        }
        return [processed];
      })
    ),
};
