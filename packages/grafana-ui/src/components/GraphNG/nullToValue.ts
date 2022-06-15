import { ArrayVector, DataFrame } from '@grafana/data';

export function nullToValue(frame: DataFrame) {
  return {
    ...frame,
    fields: frame.fields.map((field, i) => {
      const noValue = +field.config?.noValue!;
      const values = field.values.toArray();
      const transformedVals = [];

      if (!Number.isNaN(noValue)) {
        for (let i = 0; i < values.length; i++) {
          transformedVals.push(values[i] === null ? noValue : values[i]);
        }

        return {
          ...field,
          values: new ArrayVector(transformedVals),
        };
      } else {
        return field;
      }
    }),
  };
}
