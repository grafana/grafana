import { DataTransformerID } from '../ids';
import { DataTransformerInfo } from '../../../types/transformations';
import { DataFrame } from '../../../types/dataFrame';
import { DataFrameBuilder } from './DataFrameBuilder';
import { TimeFieldsByFrame } from './TimeFieldsByFrame';
import { DataFramesStackedByTime } from './DataFramesStackedByTime';

export interface MergeTransformerOptions {}

export const mergeTransformer: DataTransformerInfo<MergeTransformerOptions> = {
  id: DataTransformerID.merge,
  name: 'Merge series/tables',
  description: 'Merges multiple series/tables by time into a single serie/table',
  defaultOptions: {},
  transformer: (options: MergeTransformerOptions) => {
    return (data: DataFrame[]) => {
      if (!Array.isArray(data) || data.length <= 1) {
        return data;
      }

      const timeFields = new TimeFieldsByFrame();
      const framesStack = new DataFramesStackedByTime(timeFields);
      const dataFrameBuilder = new DataFrameBuilder();

      for (const frame of data) {
        const frameIndex = framesStack.push(frame);
        timeFields.add(frameIndex, frame);

        const timeIndex = timeFields.getFieldIndex(frameIndex);
        dataFrameBuilder.addFields(frame, timeIndex);
      }

      if (data.length !== timeFields.getLength()) {
        return data;
      }

      const { dataFrame, valueMapper } = dataFrameBuilder.build();

      for (let index = 0; index < framesStack.getLength(); index++) {
        const { frame, valueIndex, timeIndex } = framesStack.pop();
        dataFrame.add(valueMapper(frame, valueIndex, timeIndex));
      }

      return [dataFrame];
    };
  },
};
