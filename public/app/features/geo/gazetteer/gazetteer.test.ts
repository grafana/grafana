import { readFileSync } from 'fs';
import { LineString, Point } from 'ol/geom';
import { join } from 'path';

import { FieldType, toDataFrame } from '@grafana/data';
import { getCenterPointWGS84 } from 'app/features/transformers/spatial/utils';

import { frameFromGeoJSON } from '../format/geojson';
import { pointFieldFromGeohash, pointFieldFromLonLat } from '../format/utils';

import { frameAsGazetter, getGazetteer, GAZETTEER_OPTIONS } from './gazetteer';

const geojsonObject = {
  type: 'FeatureCollection',
  features: [
    {
      id: 'A',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [0, 0],
      },
      properties: {
        hello: 'A',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [1, 1],
      },
      properties: {
        some_code: 'B',
        hello: 'B',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [2, 2],
      },
      properties: {
        an_id: 'C',
        hello: 'C',
      },
    },
  ],
};

const buildPath = 'https://grafana.fake/public/build/';

describe('Legacy path rewriting', () => {
  beforeAll(() => {
    window.__grafana_build_path__ = buildPath;
  });

  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(geojsonObject),
    } as unknown as Response);
  });

  it.each([
    ['public/gazetteer/countries.json', `${buildPath}gazetteer/countries.json`],
    ['public/gazetteer/usa-states.json', `${buildPath}gazetteer/usa-states.json`],
    ['public/gazetteer/airports.geojson', `${buildPath}gazetteer/airports.geojson`],
    ['public/gazetteer/custom.json', `${buildPath}gazetteer/custom.json`],
  ])('rewrites "%s" to "%s"', async (legacyPath, expectedUrl) => {
    const gaz = await getGazetteer(legacyPath);
    expect(fetch).toHaveBeenCalledWith(expectedUrl);
    expect(gaz.path).toBe(expectedUrl);
  });

  it('resolves GAZETTEER_OPTIONS paths using the build path', () => {
    expect(GAZETTEER_OPTIONS.countries.path).toBe(`${buildPath}gazetteer/countries.json`);
    expect(GAZETTEER_OPTIONS.usaStates.path).toBe(`${buildPath}gazetteer/usa-states.json`);
    expect(GAZETTEER_OPTIONS.airports.path).toBe(`${buildPath}gazetteer/airports.geojson`);
  });

  it('does not rewrite absolute http URLs', async () => {
    const url = 'https://example.com/my-gazetteer.json';
    await getGazetteer(url);
    expect(fetch).toHaveBeenCalledWith(url);
  });
});

describe('Placename lookup from geojson format', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(geojsonObject),
    } as unknown as Response);
  });

  it('can lookup by id', async () => {
    const gaz = await getGazetteer('local');
    expect(gaz.error).toBeUndefined();
    expect(getCenterPointWGS84(gaz.find('A')?.geometry())).toMatchInlineSnapshot(`
      [
        0,
        0,
      ]
    `);
  });
  it('can look up by a code', async () => {
    const gaz = await getGazetteer('airports');
    expect(gaz.error).toBeUndefined();
    expect(getCenterPointWGS84(gaz.find('B')?.geometry())).toMatchInlineSnapshot(`
      [
        1,
        1,
      ]
    `);
  });

  it('can look up by an id property', async () => {
    const gaz = await getGazetteer('airports');
    expect(gaz.error).toBeUndefined();
    expect(getCenterPointWGS84(gaz.find('C')?.geometry())).toMatchInlineSnapshot(`
      [
        2,
        2,
      ]
    `);
  });
});

describe('airports gazetteer data', () => {
  // Built directly rather than through getGazetteer, which caches by path and is fed mock data above.
  const airports = JSON.parse(readFileSync(join(__dirname, '../../../../gazetteer/airports.geojson'), 'utf8'));
  const gaz = frameAsGazetter(frameFromGeoJSON(airports), { path: 'airports' });

  // These airports used to share MultiPoint features, so half of them could not be looked up
  // and the other half resolved to a point between two cities.
  it.each([
    ['MCI', 'KMCI', [-94.715915, 39.297896]],
    ['ICT', 'KICT', [-97.428739, 37.652928]],
    ['BHM', 'KBHM', [-86.752377, 33.561867]],
    ['BHX', 'EGBB', [-1.733732, 52.452909]],
    ['GYE', 'SEGU', [-79.88701, -2.158338]],
    ['CCS', 'SVMI', [-67.005749, 10.597355]],
  ])('resolves %s and %s to their own airport', (iata, icao, expected) => {
    for (const key of [iata, icao]) {
      const [lon, lat] = getCenterPointWGS84(gaz.find(key)?.geometry()) ?? [];
      expect(lon).toBeCloseTo(expected[0], 5);
      expect(lat).toBeCloseTo(expected[1], 5);
    }
  });
});

describe('frameAsGazetter', () => {
  describe('geometry derivation', () => {
    it.each([
      ['LAT', 'LON'],
      ['LATITUTE', 'LONGITUE'], // real (misspelled) aliases the code accepts
      ['LAT', 'LNG'],
      ['LAT', 'LONG'],
    ])('builds points from lat/lng fields named %s/%s', (latName, lngName) => {
      const frame = toDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['a'] },
          { name: latName, type: FieldType.number, values: [12] },
          { name: lngName, type: FieldType.number, values: [34] },
        ],
      });
      const latField = frame.fields.find((f) => f.name === latName)!;
      const lngField = frame.fields.find((f) => f.name === lngName)!;
      const expected = (pointFieldFromLonLat(lngField, latField).values[0] as Point).getCoordinates();

      const gaz = frameAsGazetter(frame, { path: 't' });
      expect(gaz.find('a')!.point()!.getCoordinates()).toEqual(expected);
    });

    it('derives points from a geohash field', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['g'] },
          { name: 'geohash', type: FieldType.string, values: ['9q8yy'] },
        ],
      });
      const geohashField = frame.fields.find((f) => f.name === 'geohash')!;
      const expected = (pointFieldFromGeohash(geohashField).values[0] as Point).getCoordinates();

      const gaz = frameAsGazetter(frame, { path: 't' });
      expect(gaz.find('g')!.point()!.getCoordinates()).toEqual(expected);
    });

    it('uses an existing Point geo field directly', () => {
      const pt = new Point([5, 6]);
      const frame = toDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['x'] },
          { name: 'geometry', type: FieldType.geo, values: [pt] },
        ],
      });

      const info = frameAsGazetter(frame, { path: 't' }).find('x')!;
      expect(info.geometry()).toBe(pt);
      expect(info.point()!.getCoordinates()).toEqual([5, 6]);
    });

    it('returns the centroid of a non-point geometry from point()', () => {
      const line = new LineString([
        [0, 0],
        [10, 20],
      ]);
      const frame = toDataFrame({
        fields: [
          { name: 'id', type: FieldType.string, values: ['x'] },
          { name: 'geometry', type: FieldType.geo, values: [line] },
        ],
      });

      const info = frameAsGazetter(frame, { path: 't' }).find('x')!;
      expect(info.geometry()).toBe(line);
      // point() collapses a non-point to the center of its extent
      expect(info.point()!.getCoordinates()).toEqual([5, 10]);
    });
  });

  describe('key detection', () => {
    const coords = (n: number) => ({
      lat: { name: 'LAT', type: FieldType.number, values: Array.from({ length: n }, (_, i) => i + 1) },
      lon: { name: 'LON', type: FieldType.number, values: Array.from({ length: n }, (_, i) => i + 1) },
    });

    it('keys off a *_CODE suffixed field, not the first string field', () => {
      const c = coords(1);
      const frame = toDataFrame({
        fields: [
          { name: 'label', type: FieldType.string, values: ['L'] },
          { name: 'some_code', type: FieldType.string, values: ['B'] },
          c.lat,
          c.lon,
        ],
      });
      const gaz = frameAsGazetter(frame, { path: 't' });
      expect(gaz.find('B')!.index).toBe(0);
      expect(gaz.find('L')).toBeUndefined();
    });

    it('keys off a UID field', () => {
      const c = coords(1);
      const frame = toDataFrame({
        fields: [
          { name: 'label', type: FieldType.string, values: ['L'] },
          { name: 'UID', type: FieldType.string, values: ['u1'] },
          c.lat,
          c.lon,
        ],
      });
      const gaz = frameAsGazetter(frame, { path: 't' });
      expect(gaz.find('u1')!.index).toBe(0);
      expect(gaz.find('L')).toBeUndefined();
    });

    it('falls back to the first string field when no key field exists', () => {
      const c = coords(1);
      const frame = toDataFrame({
        fields: [{ name: 'place', type: FieldType.string, values: ['P'] }, c.lat, c.lon],
      });
      expect(frameAsGazetter(frame, { path: 't' }).find('P')!.index).toBe(0);
    });

    it('resolves keys case-insensitively and returns undefined for misses', () => {
      const c = coords(2);
      const frame = toDataFrame({
        fields: [{ name: 'id', type: FieldType.string, values: ['us', 'fr'] }, c.lat, c.lon],
      });
      const gaz = frameAsGazetter(frame, { path: 't' });
      expect(gaz.find('us')!.index).toBe(0);
      expect(gaz.find('US')!.index).toBe(0);
      expect(gaz.find('fr')!.index).toBe(1);
      expect(gaz.find('zz')).toBeUndefined();
    });
  });

  it('exposes count and a bounded examples list', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'LAT', type: FieldType.number, values: [1, 2, 3] },
        { name: 'LON', type: FieldType.number, values: [4, 5, 6] },
      ],
    });
    const gaz = frameAsGazetter(frame, { path: 't' });
    expect(gaz.count).toBe(3);
    // examples(v) returns v+1 entries
    expect(gaz.examples(0)).toHaveLength(1);
    expect(gaz.examples(1)).toHaveLength(2);
    expect(gaz.frame!()).toBe(frame);
  });
});
