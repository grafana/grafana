import { DataTransformerInfo } from './transformers';
import { DataFrame } from '../../types/dataFrame';
import { DataTransformerID } from './ids';
import { DataFrameHelper } from '../dataFrameHelper';
import { KeyValue } from '../../types/data';
import { AppendedVectors } from '../vector';

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
  transformer: (options: AppendOptions) => {
    return (data: DataFrame[]) => {
      if (data.length < 2) {
        return data;
      }

      let length = 0;
      const processed = new DataFrameHelper();
      for (let i = 0; i < data.length; i++) {
        const frame = data[i];
        const used: KeyValue<boolean> = {};
        for (let j = 0; j < frame.fields.length; j++) {
          const src = frame.fields[j];
          if (used[src.name]) {
            continue;
          }
          used[src.name] = true;

          let f = processed.getFieldByName(src.name);
          if (!f) {
            f = processed.addField({
              ...src,
              values: new AppendedVectors(length),
            });
          }
          (f.values as AppendedVectors).append(src.values);
        }

        // Make sure all fields have their length updated
        length += frame.length;
        processed.length = length;
        for (const f of processed.fields) {
          (f.values as AppendedVectors).setLength(processed.length);
        }
      }
      return [processed];
    };
  },
};
