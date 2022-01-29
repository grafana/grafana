import { DataFrame, ArrayVector } from '@grafana/data';

export const fillGaps = (frame: DataFrame): DataFrame => {
  let intervalIndex = 0;
  const intervalField = frame.fields.find((f, i) => {
    if ((f.config.interval ?? 0) > 0) {
      intervalIndex = i;
      return true;
    }
    return false;
  });

  if (!intervalField) {
    return frame;
  }

  const interval = intervalField.config.interval;
  const original = frame.fields.map((f) => f.values.toArray());
  const values: any[][] = original.map(() => []);

  for (let idx = 0; idx < original[intervalIndex].length; idx++) {
    const current = original[intervalIndex][idx];
    const last = original[intervalIndex][idx > 0 ? idx - 1 : 0];
    for (let t = last + interval; t < current; t += interval) {
      values.forEach((v, i) => v.push(i === intervalIndex ? t : null));
    }
    values.forEach((v, i) => v.push(i === intervalIndex ? current : original[i][idx]));
  }

  for (let i = 0; i < frame.fields.length; i++) {
    frame.fields[i].values = new ArrayVector(values[i]);
  }

  return frame;
};
