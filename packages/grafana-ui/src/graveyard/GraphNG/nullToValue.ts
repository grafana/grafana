import { DataFrame } from '@grafana/data';

/** @deprecated */
export function nullToValue(frame: DataFrame) {
  return {
    ...frame,
    fields: frame.fields.map((field) => {
      const noValueConfig = field.config?.noValue;
      const noValue = noValueConfig !== '' && noValueConfig != null ? +noValueConfig : NaN;

      if (!Number.isNaN(noValue)) {
        const transformedVals = field.values.slice();

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
