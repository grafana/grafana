import { type DataFrame, FieldType } from '@grafana/data';

export function hasGeoCell(frame: DataFrame): boolean {
  return frame.fields.some((field) => {
    if (field.type !== FieldType.geo) {
      return false;
    }

    const firstNonNullValue = field.values.find((value) => value != null);
    return (
      firstNonNullValue != null &&
      typeof firstNonNullValue === 'object' &&
      'intersectsCoordinate' in firstNonNullValue
    );
  });
}
