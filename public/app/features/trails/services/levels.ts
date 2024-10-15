import { DataFrame } from '@grafana/data';

export function getLabelValueFromDataFrame(frame: DataFrame) {
  const labels = frame.fields[1]?.labels;

  if (!labels) {
    return null;
  }

  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return null;
  }

  return labels[keys[0]];
}
