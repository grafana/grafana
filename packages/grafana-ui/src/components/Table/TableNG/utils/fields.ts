import { FieldType, type Field } from '@grafana/data';

import { type ColumnTypes } from '../types';

/**
 * @internal
 * returns the display name of a field
 * returns the display name of a field.
 * We intentionally do not want to use @grafana/data's getFieldDisplayName here,
 * instead we have a call to cacheFieldDisplayNames up in TablePanel to handle this
 * before we begin.
 */
export const getDisplayName = (field: Field): string => {
  return field.state?.displayName ?? field.name;
};

/**
 * @internal given a field name or display name, returns a predicate function that checks if a field matches that name.
 */
export const predicateByName = (name: string) => (f: Field) => f.name === name || getDisplayName(f) === name;

/**
 * @internal
 * returns only fields that are not nested tables and not explicitly hidden
 */
export function getVisibleFields(fields: Field[]): Field[] {
  return fields.filter((field) => field.type !== FieldType.nestedFrames && field.config.custom?.hideFrom?.viz !== true);
}

/**
 * @internal
 * returns a map of column types by display name
 */
export function getColumnTypes(fields: Field[]): ColumnTypes {
  return fields.reduce<ColumnTypes>((acc, field) => {
    switch (field.type) {
      case FieldType.nestedFrames:
        return { ...acc, ...getColumnTypes(field.values[0]?.[0]?.fields ?? []) };
      default:
        return { ...acc, [getDisplayName(field)]: field.type };
    }
  }, {});
}

/**
 * @internal
 * Extracts numeric pixel value from theme spacing
 */
export const extractPixelValue = (spacing: string | number): number => {
  return typeof spacing === 'number' ? spacing : parseFloat(spacing) || 0;
};
