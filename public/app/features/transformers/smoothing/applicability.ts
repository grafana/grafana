import { type DataFrame, isTimeSeriesFrame, TransformationApplicabilityLevels } from '@grafana/data';

export function isSmoothingApplicable(data: DataFrame[]) {
  for (const frame of data) {
    if (isTimeSeriesFrame(frame)) {
      return TransformationApplicabilityLevels.Applicable;
    }
  }

  return TransformationApplicabilityLevels.NotApplicable;
}
