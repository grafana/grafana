import { DataTransformerID } from './ids';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { getTimeField, MutableDataFrame, sortDataFrame } from '../../dataframe';
import { isNumber, omit } from 'lodash';

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

      const timeFieldIndexByFrameIndex = createTimeFieldIndex(data);

      if (timeFieldNotFoundForAllFrames(timeFieldIndexByFrameIndex, data)) {
        return data;
      }

      const frames = data.map((frame, index) => sortDataFrame(frame, timeFieldIndexByFrameIndex[index]));
      const valueIndexByFrameIndex = createValueFieldIndex(data);

      const result = createMutableDataFrame(timeFieldIndexByFrameIndex, data);
      const numberOfRows = data.reduce((total, frame) => total + frame.length, 0);

      for (let index = 0; index < numberOfRows; index++) {
        const frameIndex = frames.reduce((winner, frame, index) => {
          const winnerTimeField = frames[winner].fields[timeFieldIndexByFrameIndex[winner]];
          const frameTimeField = frame.fields[timeFieldIndexByFrameIndex[index]];

          const winnerTime = winnerTimeField.values.get(valueIndexByFrameIndex[winner]);
          const frameTime = frameTimeField.values.get(valueIndexByFrameIndex[index]);

          if (!isNumber(frameTime) || winnerTime <= frameTime) {
            return winner;
          }
          return index;
        }, 0);

        const frame = frames[frameIndex];
        const valueIndex = valueIndexByFrameIndex[frameIndex];
        const timeIndex = timeFieldIndexByFrameIndex[frameIndex];
        const values = createValuesFromFrame(timeIndex, valueIndex, frame);

        valueIndexByFrameIndex[frameIndex] = valueIndex + 1;
        result.add(values, true);
      }

      return [result];
    };
  },
};

const createTimeFieldIndex = (data: DataFrame[]): Record<number, number> => {
  return data.reduce((cache: Record<number, number>, frame, index) => {
    const timeDescription = getTimeField(frame);

    if (isNumber(timeDescription?.timeIndex)) {
      cache[index] = timeDescription.timeIndex;
    }

    return cache;
  }, {});
};

const createValueFieldIndex = (data: DataFrame[]): Record<number, number> => {
  return data.reduce((cache: Record<number, number>, frame, index) => {
    cache[index] = 0;
    return cache;
  }, {});
};

function createValuesFromFrame(timeFieldIndex: number, valueFieldIndex: number, frame: DataFrame): Record<string, any> {
  const values: Record<string, any> = {
    metric: `${frame.name}-series`,
  };
  const isTimeAndValueFrame = frame.fields.length === 2;

  for (let index = 0; index < frame.fields.length; index++) {
    const field = frame.fields[index];
    const value = field.values.get(valueFieldIndex);

    if (index === timeFieldIndex) {
      values['time'] = value;
      continue;
    }

    if (isTimeAndValueFrame) {
      values['value'] = value;
      continue;
    }

    values[field.name] = value;
  }

  return values;
}

const timeFieldNotFoundForAllFrames = (timeFieldIndex: Record<number, number>, data: DataFrame[]): boolean => {
  return Object.keys(timeFieldIndex).length !== data.length;
};

const createMutableDataFrame = (timeFieldByFrame: Record<number, number>, data: DataFrame[]): MutableDataFrame => {
  const singleValueField = !data.find(frame => frame.fields.length > 2);
  const dataFrame = new MutableDataFrame();
  const timeFieldIndex = timeFieldByFrame[0];
  const timeField = data[0].fields[timeFieldIndex];

  dataFrame.addField({
    ...omit(timeField, ['values', 'name']),
    name: 'time',
  });

  dataFrame.addField({
    name: 'metric',
    type: FieldType.string,
    config: {},
  });

  if (singleValueField) {
    const valueField = data[0].fields.find((field, index) => index !== timeFieldIndex);

    dataFrame.addField({
      ...omit(valueField, ['values', 'name']),
      name: 'value',
    });

    return dataFrame;
  }

  return data.reduce((mutableFrame: MutableDataFrame, frame, frameIndex) => {
    const timeIndex = timeFieldByFrame[frameIndex];

    return frame.fields.reduce((mutableFrame: MutableDataFrame, field, fieldIndex) => {
      if (fieldIndex === timeIndex) {
        return mutableFrame;
      }

      mutableFrame.addField({
        ...omit(field, ['values']),
      });

      return mutableFrame;
    }, mutableFrame);
  }, dataFrame);
};
