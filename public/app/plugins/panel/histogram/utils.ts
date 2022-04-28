import { DataFrame, FieldType } from '@grafana/data';
import {
  histogramFrameBucketMinFieldName,
  histogramFrameBucketMaxFieldName,
} from '@grafana/data/src/transformations/transformers/histogram';

export function originalDataHasHistogram(frames?: DataFrame[]): boolean {
  if (frames?.length !== 1) {
    return false;
  }
  const frame = frames[0];
  if (frame.fields.length < 3) {
    return false;
  }

  if (
    frame.fields[0].name !== histogramFrameBucketMinFieldName ||
    frame.fields[1].name !== histogramFrameBucketMaxFieldName
  ) {
    return false;
  }
  for (const field of frame.fields) {
    if (field.type !== FieldType.number) {
      return false;
    }
  }

  return true;
}
