import { FilterOptions, filterFramesTransformer } from './filter';
import { DataTransformerInfo } from '../../types/transformations';
import { DataTransformerID } from './ids';
import { DataFrame, Field } from '../../dataframe';
import { MutableDataFrame } from '../../dataframe/MutableDataFrame';

export interface MergeDataFrameTransformOptions {}

export const mergeDataFramesTransformer: DataTransformerInfo<MergeDataFrameTransformOptions> = {
  id: DataTransformerID.merge,
  name: 'Merge',
  description: 'Merge many data frames into one',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: options => {
    return (data: DataFrame[]) => {
      return [mergeDataFrames(data)];
    };
  },
};

export function mergeDataFrames(data: DataFrame[]): DataFrame {
  const fieldNames: Record<string, any> = {};

  const result = new MutableDataFrame();

  for (const dataFrame of data) {
    for (const field of dataFrame.fields) {
      if (fieldNames[field.name] === undefined) {
        fieldNames[field.name] = result.fields.length;
        result.addField(field);
      } else {
        // field with same name exists, match values or add values
        // TODO
      }
    }
  }

  return result;
}
