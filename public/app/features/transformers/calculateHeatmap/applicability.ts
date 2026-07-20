import { type DataFrame, type Field, FieldType, TransformationApplicabilityLevels } from '@grafana/data';

export function isHeatmapApplicable(data: DataFrame[]) {
  const { xField, yField, xs, ys } = findHeatmapFields(data);

  if (xField || yField) {
    return TransformationApplicabilityLevels.NotPossible;
  }

  if (!xs.length || !ys.length) {
    return TransformationApplicabilityLevels.NotPossible;
  }

  return TransformationApplicabilityLevels.Applicable;
}

function findHeatmapFields(frames: DataFrame[]) {
  let xField: Field | undefined = undefined;
  let yField: Field | undefined = undefined;
  let dataLen = 0;

  for (let frame of frames) {
    const x = frame.fields.find((f) => f.type === FieldType.time);
    if (x) {
      dataLen += frame.length;
    }
  }

  let xs: number[] = Array(dataLen);
  let ys: number[] = Array(dataLen);
  let j = 0;

  for (let frame of frames) {
    const x = frame.fields.find((f) => f.type === FieldType.time);
    if (!x) {
      continue;
    }

    if (!xField) {
      xField = x;
    }

    const xValues = x.values;
    for (let field of frame.fields) {
      if (field !== x && field.type === FieldType.number) {
        const yValues = field.values;

        for (let i = 0; i < xValues.length; i++, j++) {
          xs[j] = xValues[i];
          ys[j] = yValues[i];
        }

        if (!yField) {
          yField = field;
        }
      }
    }
  }

  return { xField, yField, xs, ys };
}
