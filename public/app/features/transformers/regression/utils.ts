import { type DataFrame, type Field } from '@grafana/data/dataframe';

export const findFirstFieldByMatcher = (
  input: DataFrame[],
  matcher: (field: Field, frame: DataFrame, input: DataFrame[]) => boolean,
  excludeField?: Field
): Field | undefined => {
  for (const frame of input) {
    const field = frame.fields.find((field) => matcher(field, frame, input) && field !== excludeField);
    if (field) {
      return field;
    }
  }
  return undefined;
};
