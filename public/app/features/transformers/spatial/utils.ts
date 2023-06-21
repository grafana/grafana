import { getCenter } from 'ol/extent';
import { Geometry, LineString, Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { getArea, getLength } from 'ol/sphere';

import { Field, FieldType } from '@grafana/data';

import { SpatialCalculation, SpatialCalculationOption } from './models.gen';

/** Will return a field with a single row */
export function toLineString(field: Field<Geometry | undefined>): LineString {
  const coords: number[][] = [];
  for (const geo of field.values) {
    if (geo) {
      coords.push(getCenterPoint(geo));
    }
  }
  return new LineString(coords);
}

/** Will return a field with a single row */
export function calculateBearings(values: Array<Geometry | undefined>): number[] {
  const bearing = new Array(values.length);
  if (values.length > 1) {
    let prev: number[] | undefined = getCenterPointWGS84(values[0]);
    for (let i = 1; i < values.length; i++) {
      let next: number[] | undefined = getCenterPointWGS84(values[i]);
      if (prev && next) {
        let degrees = (Math.atan2(next[0] - prev[0], next[1] - prev[1]) * 180) / Math.PI;
        if (degrees < 0.0) {
          degrees += 360.0;
        }
        bearing[i - 1] = bearing[i] = degrees;
      }
    }
  } else {
    bearing.fill(0);
  }
  return bearing;
}

export function getCenterPoint(geo: Geometry): number[] {
  if (geo instanceof Point) {
    return (geo as Point).getCoordinates();
  }
  return getCenter(geo.getExtent());
}

export function getCenterPointWGS84(geo?: Geometry): number[] | undefined {
  if (!geo) {
    return undefined;
  }
  return toLonLat(getCenterPoint(geo));
}

/** Will return a new field with calculated values */
export function doGeomeryCalculation(field: Field<Geometry | undefined>, options: SpatialCalculationOption): Field {
  const values = field.values;
  const buffer = new Array(field.values.length);
  const op = options.calc ?? SpatialCalculation.Heading;
  const name = options.field ?? op;

  switch (op) {
    case SpatialCalculation.Area: {
      for (let i = 0; i < values.length; i++) {
        const geo = values[i];
        if (geo) {
          buffer[i] = getArea(geo);
        }
      }
      return {
        name,
        type: FieldType.number,
        config: {
          unit: 'areaM2',
        },
        values: buffer,
      };
    }
    case SpatialCalculation.Distance: {
      for (let i = 0; i < values.length; i++) {
        const geo = values[i];
        if (geo) {
          buffer[i] = getLength(geo);
        }
      }
      return {
        name,
        type: FieldType.number,
        config: {
          unit: 'lengthm',
        },
        values: buffer,
      };
    }

    // Use heading as default
    case SpatialCalculation.Heading:
    default: {
      return {
        name,
        type: FieldType.number,
        config: {
          unit: 'degree',
        },
        values: calculateBearings(values),
      };
    }
  }
}
