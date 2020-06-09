import { DataTransformerID } from './ids';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { DataFrame, FieldType, Field, FieldDTO } from '../../types/dataFrame';
import { getTimeField, MutableDataFrame, sortDataFrame } from '../../dataframe';
import { isNumber, omit } from 'lodash';
import { timeComparer } from '../../field/fieldComparers';
import { getFieldDisplayName, getFrameDisplayName } from '../../field';

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
      const dataFrameBuilder = new DataFrameBuilder(timeFields);

      for (const frame of data) {
        const frameIndex = framesStack.push(frame);
        timeFields.add(frameIndex, frame);
        dataFrameBuilder.addFields(frameIndex, frame);
      }

      if (data.length !== timeFields.getLength()) {
        return data;
      }

      for (let index = 0; index < framesStack.getLength(); index++) {
        const { frame, valueIndex, frameIndex } = framesStack.pop();
        dataFrameBuilder.addValuesAsRow(frame, valueIndex, frameIndex);
      }

      return [dataFrameBuilder.build()];
    };
  },
};
class DataFrameBuilder {
  private isTimeSeries: boolean;
  private valueFields: Record<string, FieldDTO>;
  private timeField: FieldDTO | null;
  private dataFrames: DataFrame[];
  private dataFrame: MutableDataFrame | null;

  constructor(private timeFields: TimeFieldsByFrame) {
    this.isTimeSeries = true;
    this.valueFields = {};
    this.timeField = null;
    this.dataFrames = [];
    this.dataFrame = null;
  }

  addFields(frameIndex: number, frame: DataFrame): void {
    const timeIndex = this.timeFields.getFieldIndex(frameIndex);

    if (frame.fields.length > 2) {
      this.isTimeSeries = false;
    }

    this.dataFrames.push(frame);

    for (let index = 0; index < frame.fields.length; index++) {
      const field = frame.fields[index];

      if (index === timeIndex) {
        if (!this.timeField) {
          this.timeField = this.copyStructure(field, 'time');
        }
        continue;
      }

      const fieldName = field.name ?? getFieldDisplayName(field, frame, this.dataFrames);

      if (this.valueFields[fieldName]) {
        continue;
      }

      this.valueFields[fieldName] = this.copyStructure(field, fieldName);
    }
  }

  addValuesAsRow(frame: DataFrame, valueIndex: number, frameIndex: number) {
    if (!this.dataFrame) {
      this.dataFrame = this.createDataFrame();
    }

    const timeIndex = this.timeFields.getFieldIndex(frameIndex);

    const values = frame.fields.reduce((values: Record<string, any>, field, index) => {
      const value = field.values.get(valueIndex);

      if (index === timeIndex) {
        values['time'] = value;
        values['metric'] = `${frame.name}-series`;
        return values;
      }

      if (this.isTimeSeries) {
        values['value'] = value;
        return values;
      }

      values[field.name] = value;
      return values;
    }, {});

    this.dataFrame.add(values);
  }

  build(): MutableDataFrame {
    if (!this.dataFrame) {
      return new MutableDataFrame();
    }
    return this.dataFrame;
  }

  private createDataFrame(): MutableDataFrame {
    const dataFrame = new MutableDataFrame();

    if (this.timeField) {
      dataFrame.addField(this.timeField);

      dataFrame.addField({
        name: 'metric',
        type: FieldType.string,
      });
    }

    const valueFields = Object.values(this.valueFields);

    if (this.isTimeSeries) {
      if (valueFields.length > 0) {
        dataFrame.addField({
          ...valueFields[0],
          name: 'value',
        });
      }

      return dataFrame;
    }

    for (const field of valueFields) {
      dataFrame.addField(field);
    }

    return dataFrame;
  }

  private copyStructure(field: Field, name: string): FieldDTO {
    return {
      ...omit(field, ['values', 'name']),
      name,
    };
  }
}

interface DataFrameStackValue {
  valueIndex: number;
  frameIndex: number;
  frame: DataFrame;
}
class DataFramesStackedByTime {
  private valuesPointerByFrame: Record<number, number>;
  private dataFrames: DataFrame[];
  private isSorted: boolean;

  constructor(private timeFields: TimeFieldsByFrame) {
    this.valuesPointerByFrame = {};
    this.dataFrames = [];
    this.isSorted = false;
  }

  push(frame: DataFrame): number {
    const index = this.dataFrames.length;
    this.valuesPointerByFrame[index] = 0;
    this.dataFrames.push(frame);
    return index;
  }

  pop(): DataFrameStackValue {
    if (!this.isSorted) {
      this.sortByTime();
      this.isSorted = true;
    }

    const frameIndex = this.dataFrames.reduce((champion, frame, index) => {
      const championTime = this.peekTimeValueForFrame(champion);
      const contenderTime = this.peekTimeValueForFrame(index);
      return timeComparer(contenderTime, championTime) >= 0 ? champion : index;
    }, 0);

    const previousPointer = this.movePointerForward(frameIndex);

    return {
      frame: this.dataFrames[frameIndex],
      valueIndex: previousPointer,
      frameIndex: frameIndex,
    };
  }

  getLength(): number {
    const frames = Object.values(this.dataFrames);
    return frames.reduce((length: number, frame) => (length += frame.length), 0);
  }

  private peekTimeValueForFrame(frameIndex: number): any {
    const timeField = this.timeFields.getField(frameIndex);
    const valuePointer = this.valuesPointerByFrame[frameIndex];
    return timeField.values.get(valuePointer);
  }

  private movePointerForward(frameIndex: number): number {
    const currentPointer = this.valuesPointerByFrame[frameIndex];
    this.valuesPointerByFrame[frameIndex] = currentPointer + 1;

    return currentPointer;
  }

  private sortByTime() {
    this.dataFrames = this.dataFrames.map((frame, index) => {
      const timeFieldIndex = this.timeFields.getFieldIndex(index);
      return sortDataFrame(frame, timeFieldIndex);
    });
  }
}
class TimeFieldsByFrame {
  private timeIndexByFrameIndex: Record<number, number>;
  private timeFieldByFrameIndex: Record<number, Field>;

  constructor() {
    this.timeIndexByFrameIndex = {};
    this.timeFieldByFrameIndex = {};
  }

  add(frameIndex: number, frame: DataFrame): void {
    const fieldDescription = getTimeField(frame);
    const timeIndex = fieldDescription?.timeIndex;
    const timeField = fieldDescription?.timeField;

    if (isNumber(timeIndex)) {
      this.timeIndexByFrameIndex[frameIndex] = timeIndex;
    }

    if (timeField) {
      this.timeFieldByFrameIndex[frameIndex] = timeField;
    }
  }

  getField(frameIndex: number): Field {
    return this.timeFieldByFrameIndex[frameIndex];
  }

  getFieldIndex(frameIndex: number): number {
    return this.timeIndexByFrameIndex[frameIndex];
  }

  has(frameIndex: number): boolean {
    return typeof this.timeFieldByFrameIndex[frameIndex] === 'number';
  }

  getLength() {
    return Object.keys(this.timeIndexByFrameIndex).length;
  }
}
