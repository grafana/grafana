import { ArrayVector, Field, FieldType } from '@grafana/data';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { decodeGeohash } from './geohash';

export function pointFieldFromGeohash(geohash: Field<string>): Field<Point> {
  return {
    name: 'point',
    type: FieldType.geo,
    values: new ArrayVector<any>(
      geohash.values.toArray().map((v) => {
        const coords = decodeGeohash(v);
        if (coords) {
          return new Point(fromLonLat(coords));
        }
        return undefined;
      })
    ),
    config: {},
  };
}

export function pointFieldFromLonLat(lon: Field, lat: Field): Field<Point> {
  const buffer = new Array<Point>(lon.values.length);
  for (let i = 0; i < lon.values.length; i++) {
    buffer[i] = new Point(fromLonLat([lon.values.get(i), lat.values.get(i)]));
  }

  return {
    name: 'point',
    type: FieldType.geo,
    values: new ArrayVector(buffer),
    config: {},
  };
}
