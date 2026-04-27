import { type Geometry } from 'ol/geom';

import { type DataFrame, FieldType } from '@grafana/data/dataframe';

/**
 * Type guard to check if a value is an OpenLayers Geometry object.
 * Avoids importing the entire OpenLayers library in files that just need to check for Geometry types.
 * @param value the value to check.
 * @returns true if the value is a Geometry object
 */
export function isGeometry(value: unknown): value is Geometry {
  return typeof value === 'object' && value != null && 'intersectsCoordinate' in value;
}

/**
 * Checks if a DataFrame contains at least one geo field with at least one non-null Geometry value.
 * @param frame the DataFrame to check.
 * @returns true if the DataFrame contains geo fields
 */
export function hasGeoCell(frame: DataFrame): boolean {
  return frame.fields.some((field) => {
    if (field.type !== FieldType.geo) {
      return false;
    }

    return field.values.some(isGeometry);
  });
}
