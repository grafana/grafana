import { isNumber } from 'lodash';
import { Field, DataFrame } from '../../../types/dataFrame';
import { getTimeField } from '../../../dataframe';

export class TimeFieldsByFrame {
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

  getLength() {
    return Object.keys(this.timeIndexByFrameIndex).length;
  }
}
