import { DataTransformerID } from './ids';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { DataFrame } from '../../types/dataFrame';
import { DataFrameBuilder } from './merge/dataFrameBuilder';
import { TimeFieldsByFrame } from './merge/timeFieldsByFrame';
import { DataFramesStackedByTime } from './merge/dataFramesStacked';

export interface SeriesToRowsOptions {
  fields?: MatcherConfig; // Assume all fields
}

export const seriesToRowsTransformer: DataTransformerInfo<SeriesToRowsOptions> = {
  id: DataTransformerID.seriesToRows,
  name: 'Series as rows',
  description: 'Groups series by time and returns series as rows',
  defaultOptions: {},
  transformer: (options: SeriesToRowsOptions) => {
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
