import { DataFrame } from '../../../types/dataFrame';
import { timeComparer } from '../../../field/fieldComparers';
import { sortDataFrame } from '../../../dataframe';
import { TimeFieldsByFrame } from './TimeFieldsByFrame';

interface DataFrameStackValue {
  valueIndex: number;
  timeIndex: number;
  frame: DataFrame;
}
export class DataFramesStackedByTime {
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
      timeIndex: this.timeFields.getFieldIndex(frameIndex),
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
