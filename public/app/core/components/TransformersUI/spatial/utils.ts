import { ArrayVector, Field, FieldType } from '@grafana/data';
import { getCenter } from 'ol/extent';
import { Geometry, LineString, Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { getArea, getLength } from 'ol/sphere';
import { CalculateFunction, CalculateOptions } from './models.gen';

/** Will return a field with a single row */
export function toLineStringField(field: Field<Geometry | undefined>): Field<Geometry> {
  const coords: number[][] = [];
  for (const geo of field.values.toArray()) {
    if (geo) {
      coords.push(getCenterPoint(geo));
    }
  }
  let name = field.name;
  if (!name || name === 'Point') {
    name = 'Line';
  }

  return {
    ...field,
    parse: undefined,
    type: FieldType.geo,
    values: new ArrayVector([new LineString(coords)]),
  };
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
export function doGeomeryCalculation(field: Field<Geometry | undefined>, options: CalculateOptions): Field {
  const values = field.values.toArray();
  const buffer = new Array(field.values.length);

  switch (options?.what) {
    case CalculateFunction.Heading: {
      return {
        name: 'Heading',
        type: FieldType.number,
        config: {
          unit: 'degree',
        },
        values: new ArrayVector(calculateBearings(values)),
      };
    }
    case CalculateFunction.Distance: {
      for (let i = 0; i < values.length; i++) {
        const geo = values[i];
        if (geo) {
          buffer[i] = getLength(geo);
        }
      }
      return {
        name: 'Distance',
        type: FieldType.number,
        config: {
          unit: 'lengthm',
        },
        values: new ArrayVector(buffer),
      };
    }
  }

  // Default to area
  for (let i = 0; i < values.length; i++) {
    const geo = values[i];
    if (geo) {
      buffer[i] = getArea(geo);
    }
  }
  return {
    name: 'Area',
    type: FieldType.number,
    config: {
      unit: 'areaM2',
    },
    values: new ArrayVector(buffer),
  };
}
