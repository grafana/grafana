import Photo from 'ol-ext/style/Photo';
import Feature from 'ol/Feature';
import { Geometry, GeometryCollection, LineString, Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Stroke, Style } from 'ol/style';

import { ArrayVector, Field, FieldConfig, FieldType } from '@grafana/data';
import { getCenterPoint } from 'app/features/transformers/spatial/utils';

import { Gazetteer } from '../gazetteer/gazetteer';

import { decodeGeohash } from './geohash';

export function pointFieldFromGeohash(geohash: Field<string>): Field<Point> {
  return {
    name: geohash.name ?? 'Point',
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
    config: hiddenTooltipField,
  };
}

export function pointFieldFromLonLat(lon: Field, lat: Field): Field<Point> {
  const buffer = new Array<Point>(lon.values.length);
  for (let i = 0; i < lon.values.length; i++) {
    const longitude = lon.values.get(i);
    const latitude = lat.values.get(i);

    // TODO: Add unit tests to thoroughly test out edge cases
    // If longitude or latitude are null, don't add them to buffer
    if (longitude === null || latitude === null) {
      continue;
    }
    buffer[i] = new Point(fromLonLat([longitude, latitude]));
  }

  return {
    name: 'Point',
    type: FieldType.geo,
    values: new ArrayVector(buffer),
    config: hiddenTooltipField,
  };
}

export function imageFieldFromLonLat(lon: Field, lat: Field, src: Field): Field<Feature> {
  const buffer = new Array<Feature>(lon.values.length);
  for (let i = 0; i < lon.values.length; i++) {
    const longitude = lon.values.get(i);
    const latitude = lat.values.get(i);
    const imageSource = src.values.get(i);

    // TODO: Add unit tests to thoroughly test out edge cases
    // If longitude or latitude are null, don't add them to buffer
    if (longitude === null || latitude === null) {
      continue;
    }

    const imageStyle = new Style({
      image: new Photo({
        src: imageSource,
        radius: 20,
        crop: true,
        kind: 'square',
        stroke: new Stroke({
          width: 2,
          color: '#000',
        }),
      }),
    });
    const imagePoint = new Feature({
      geometry: new Point(fromLonLat([longitude, latitude])),
      style: imageStyle,
    });
    buffer[i] = imagePoint;
  }

  return {
    name: 'Point',
    type: FieldType.geo,
    values: new ArrayVector(buffer),
    config: hiddenTooltipField,
  };
}

export function getGeoFieldFromGazetteer(gaz: Gazetteer, field: Field<string>): Field<Geometry | undefined> {
  const count = field.values.length;
  const geo = new Array<Geometry | undefined>(count);
  for (let i = 0; i < count; i++) {
    geo[i] = gaz.find(field.values.get(i))?.geometry();
  }
  return {
    name: 'Geometry',
    type: FieldType.geo,
    values: new ArrayVector(geo),
    config: hiddenTooltipField,
  };
}

export function createGeometryCollection(
  src: Field<Geometry | undefined>,
  dest: Field<Geometry | undefined>
): Field<Geometry | undefined> {
  const v0 = src.values.toArray();
  const v1 = dest.values.toArray();
  if (!v0 || !v1) {
    throw 'missing src/dest';
  }
  if (v0.length !== v1.length) {
    throw 'Source and destination field lengths do not match';
  }

  const count = src.values.length!;
  const geo = new Array<Geometry | undefined>(count);
  for (let i = 0; i < count; i++) {
    const a = v0[i];
    const b = v1[i];
    if (a && b) {
      geo[i] = new GeometryCollection([a, b]);
    } else if (a) {
      geo[i] = a;
    } else if (b) {
      geo[i] = b;
    }
  }
  return {
    name: 'Geometry',
    type: FieldType.geo,
    values: new ArrayVector(geo),
    config: hiddenTooltipField,
  };
}

export function createLineBetween(
  src: Field<Geometry | undefined>,
  dest: Field<Geometry | undefined>
): Field<Geometry | undefined> {
  const v0 = src.values.toArray();
  const v1 = dest.values.toArray();
  if (!v0 || !v1) {
    throw 'missing src/dest';
  }
  if (v0.length !== v1.length) {
    throw 'Source and destination field lengths do not match';
  }

  const count = src.values.length!;
  const geo = new Array<Geometry | undefined>(count);
  for (let i = 0; i < count; i++) {
    const a = v0[i];
    const b = v1[i];
    if (a && b) {
      geo[i] = new LineString([getCenterPoint(a), getCenterPoint(b)]);
    }
  }
  return {
    name: 'Geometry',
    type: FieldType.geo,
    values: new ArrayVector(geo),
    config: hiddenTooltipField,
  };
}

const hiddenTooltipField: FieldConfig = Object.freeze({
  custom: {
    hideFrom: { tooltip: true },
  },
});
