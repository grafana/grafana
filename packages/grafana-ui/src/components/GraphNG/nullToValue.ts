import { DataFrame } from '@grafana/data';

export function nullToValue(frame: DataFrame) {
  return {
    ...frame,
    fields: frame.fields.map((field) => {
      const noValue = +field.config?.noValue!;

      if (!Number.isNaN(noValue)) {
        const transformedVals = field.values.toArray().slice();

        for (let i = 0; i < transformedVals.length; i++) {
          if (transformedVals[i] === null) {
            transformedVals[i] = noValue;
          }
        }

        return {
          ...field,
          values: transformedVals,
        };
      } else {
        return field;
      }
    }),
  };
}
