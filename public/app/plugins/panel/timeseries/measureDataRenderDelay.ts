import { closestIdx, DataFrame, FieldType } from '@grafana/data';
import { LivePerformance, MeasurementName } from 'app/core/services/LivePerformance';

const measureDataRenderDelayForFrame = (prevFrame: DataFrame, newFrame: DataFrame, now: number) => {
  if (!prevFrame.length || !newFrame.length) {
    return;
  }

  const newFrameTimeField = newFrame.fields?.find((f) => f.type === FieldType.time);
  const oldFrameTimeField = prevFrame.fields?.find((f) => f.type === FieldType.time);
  if (!oldFrameTimeField || !newFrameTimeField) {
    return;
  }

  const oldValues = oldFrameTimeField.values.toArray();
  const newValues = newFrameTimeField.values.toArray();

  const latestTimeInOldFrame = oldValues[oldValues.length - 1];

  const closest = closestIdx(latestTimeInOldFrame, newValues);

  const firstBiggerIndex = newValues[closest] > latestTimeInOldFrame ? closest : closest + 1;
  if (newValues[firstBiggerIndex]) {
    LivePerformance.instance()?.add(MeasurementName.DataRenderDelay, now - newValues[firstBiggerIndex]);
  }
};

export type MeasureDataRenderDelay = (frames: DataFrame[], oldFrames: DataFrame[]) => void;

export const measureDataRenderDelay: MeasureDataRenderDelay = (frames, prevFrames) => {
  const now = Date.now();
  prevFrames.forEach((prevFrame, i) => {
    const newFrame = frames[i];
    if (newFrame) {
      measureDataRenderDelayForFrame(prevFrame, newFrame, now);
    }
  });
};
