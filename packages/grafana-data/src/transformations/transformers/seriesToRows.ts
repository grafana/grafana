import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { DataFrame } from '../../types/dataFrame';
import { DataFrameBuilder } from './merge/DataFrameBuilder';
import { TimeFieldsByFrame } from './merge/TimeFieldsByFrame';
import { DataFramesStackedByTime } from './merge/DataFramesStackedByTime';
import { isTimeSeries } from '../../dataframe/utils';

export interface SeriesToRowsTransformerOptions {}

export const seriesToRowsTransformer: DataTransformerInfo<SeriesToRowsTransformerOptions> = {
  id: DataTransformerID.seriesToRows,
  name: 'Series to rows',
  description: 'Combines multiple series into a single serie and appends a column with metric name per value.',
  defaultOptions: {},
  transformer: (options: SeriesToRowsTransformerOptions) => {
    return (data: DataFrame[]) => {
      if (!Array.isArray(data) || data.length <= 1) {
        return data;
      }

      if (!isTimeSeries(data)) {
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
