import { DataFrame, ArrayVector, FieldType } from '@grafana/data';

export const fillGaps = (frame: DataFrame): DataFrame => {
  if (frame.length < 2) {
    return frame;
  }

  let intervalIndex = 0;
  const intervalField = frame.fields.find((f, i) => {
    if (f.type !== FieldType.time && f.type !== FieldType.number) {
      return false;
    }
    if ((f.config.interval ?? 0) <= 0) {
      return false;
    }
    intervalIndex = i;
    return true;
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

  return {
    ...frame,
    length: values[0].length,
    fields: frame.fields.map((field, i) => ({
      ...field,
      values: new ArrayVector(values[i]),
    })),
  };
};
