import { type Field, FieldType, isDataFrame } from '@grafana/data';

/**
 * Fields holding DataFrames (sparkline columns, expandable sub-tables) have no meaningful one-line
 * representation, and `applyFieldOverrides` gives every frame a circular `__dataContext`
 * back-reference to the field that owns it, so they cannot be serialized either.
 *
 * The declared type is checked first so these fields drop out before they can influence the
 * `allNumeric` sort decision; {@link isFrameValue} then covers frames arriving under a type that
 * doesn't advertise them (`other`, or untyped).
 */
export const isFrameValuedField = (field: Field) =>
  field.type === FieldType.frame || field.type === FieldType.nestedFrames;

// nestedFrames values are DataFrame[], frame values a single DataFrame. Only the first element is
// inspected: the array is homogeneous by contract, and this runs against every hovered value.
export const isFrameValue = (value: unknown) => isDataFrame(value) || (Array.isArray(value) && isDataFrame(value[0]));
