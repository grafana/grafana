import { GeometryCollection, LineString, Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';

import { type Field, FieldType } from '@grafana/data';

import { type Gazetteer } from '../gazetteer/gazetteer';

import { decodeGeohash } from './geohash';
import {
  createGeometryCollection,
  createLineBetween,
  getGeoFieldFromGazetteer,
  pointFieldFromGeohash,
  pointFieldFromLonLat,
} from './utils';

function geohashField(values: string[], name = 'GH'): Field<string> {
  return { name, type: FieldType.string, values, config: {} };
}

function numberField(name: string, values: Array<number | null>): Field {
  return { name, type: FieldType.number, values, config: {} };
}

function geometryField(values: Array<Point | undefined>): Field<Point | undefined> {
  return { name: 'g', type: FieldType.geo, values, config: {} };
}

describe('pointFieldFromGeohash', () => {
  it('decodes a valid geohash into the Point that round-trips through fromLonLat', () => {
    const hash = '9q8yy';
    const out = pointFieldFromGeohash(geohashField([hash]));
    expect(out.values).toHaveLength(1);
    const geom = out.values[0];
    expect(geom).toBeInstanceOf(Point);

    // Compute the same expected coordinate the production code does: decode then project.
    // (Using a tight tolerance against a hand-typed lon/lat would assert geohash precision,
    // not the function under test.)
    const decoded = decodeGeohash(hash)!;
    const expected = fromLonLat(decoded);
    expect((geom as Point).getCoordinates()).toEqual(expected);
  });

  it('returns undefined for an empty geohash value', () => {
    const out = pointFieldFromGeohash(geohashField(['']));
    expect(out.values[0]).toBeUndefined();
  });

  it('preserves the field name from the input', () => {
    const out = pointFieldFromGeohash(geohashField(['9q8yy'], 'myField'));
    expect(out.name).toBe('myField');
    expect(out.type).toBe(FieldType.geo);
  });
});

describe('pointFieldFromLonLat', () => {
  it('builds Points for matched lon/lat rows', () => {
    const out = pointFieldFromLonLat(numberField('lon', [-122, 0]), numberField('lat', [37, 0]));
    expect(out.values).toHaveLength(2);
    expect(out.values[0]).toBeInstanceOf(Point);
    const expected = fromLonLat([-122, 37]);
    const [x, y] = (out.values[0] as Point).getCoordinates();
    expect(x).toBeCloseTo(expected[0], -3);
    expect(y).toBeCloseTo(expected[1], -3);
  });

  it('leaves rows where lon or lat is null as undefined', () => {
    const out = pointFieldFromLonLat(numberField('lon', [-122, null, 1]), numberField('lat', [37, 0, null]));
    expect(out.values[0]).toBeInstanceOf(Point);
    expect(out.values[1]).toBeUndefined();
    expect(out.values[2]).toBeUndefined();
  });

  it('handles an empty input array', () => {
    const out = pointFieldFromLonLat(numberField('lon', []), numberField('lat', []));
    expect(out.values).toHaveLength(0);
  });
});

describe('getGeoFieldFromGazetteer', () => {
  const stubGazetteer = {
    find: (k: string) => (k === 'US' ? { geometry: () => new Point([0, 0]) } : undefined),
  } as unknown as Gazetteer;

  it('returns the gazetteer geometry when the key matches', () => {
    const out = getGeoFieldFromGazetteer(stubGazetteer, geohashField(['US']));
    expect(out.values[0]).toBeInstanceOf(Point);
  });

  it('returns undefined for keys with no gazetteer hit', () => {
    const out = getGeoFieldFromGazetteer(stubGazetteer, geohashField(['US', 'NOT-A-COUNTRY']));
    expect(out.values[0]).toBeInstanceOf(Point);
    expect(out.values[1]).toBeUndefined();
  });
});

describe('createGeometryCollection', () => {
  it('merges two geometries into a GeometryCollection per row and falls back when one side is undefined', () => {
    const src = geometryField([new Point([0, 0]), new Point([1, 1]), undefined]);
    const dest = geometryField([new Point([2, 2]), undefined, new Point([3, 3])]);

    const out = createGeometryCollection(src, dest);

    expect(out.values[0]).toBeInstanceOf(GeometryCollection);
    expect((out.values[0] as GeometryCollection).getGeometries()).toHaveLength(2);
    // single-side falls through to the non-undefined geometry
    expect(out.values[1]).toBeInstanceOf(Point);
    expect(out.values[2]).toBeInstanceOf(Point);
  });

  it('throws when source and destination field lengths do not match', () => {
    const src = geometryField([new Point([0, 0])]);
    const dest = geometryField([new Point([1, 1]), new Point([2, 2])]);
    expect(() => createGeometryCollection(src, dest)).toThrow(/lengths do not match/);
  });
});

describe('createLineBetween', () => {
  it('emits a LineString between the two row geometries', () => {
    const src = geometryField([new Point([0, 0])]);
    const dest = geometryField([new Point([10, 10])]);
    const out = createLineBetween(src, dest);
    expect(out.values[0]).toBeInstanceOf(LineString);
    const coords = (out.values[0] as LineString).getCoordinates();
    expect(coords).toEqual([
      [0, 0],
      [10, 10],
    ]);
  });

  it('emits undefined for rows where either side is missing', () => {
    const src = geometryField([new Point([0, 0]), undefined]);
    const dest = geometryField([undefined, new Point([1, 1])]);
    const out = createLineBetween(src, dest);
    expect(out.values[0]).toBeUndefined();
    expect(out.values[1]).toBeUndefined();
  });
});
