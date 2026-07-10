import { type Field, FieldType } from '../../types/dataFrame';

export const alwaysFieldMatcher = (field: Field) => {
  return true;
};

export const notTimeFieldMatcher = (field: Field) => {
  return field.type !== FieldType.time;
};
