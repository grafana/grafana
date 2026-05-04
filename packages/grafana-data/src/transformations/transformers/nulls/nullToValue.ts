import { type DataFrame, type Field } from '../../../types/dataFrame';

export function nullToValue(frame: DataFrame) {
  return {
    ...frame,
    fields: frame.fields.map((field) => {
      const noValueConfig = field.config.noValue;

      // Number('') returns 0, which would incorrectly replace nulls with 0
      if (noValueConfig === '' || noValueConfig == null) {
        return field;
      }

      const noValue = Number(noValueConfig);

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
