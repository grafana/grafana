import { DataFrame, Field } from '../../../types';

export function nullToValue(frame: DataFrame) {
  return {
    ...frame,
    fields: frame.fields.map((field) => {
      const noValue = Number(field.config.noValue);

      if (!Number.isNaN(noValue)) {
        return nullToValueField(field, noValue);
      } else {
        return field;
      }
    }),
  };
}

export function nullToValueField(field: Field, noValue: number) {
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
}
