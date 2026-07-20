import { type Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';

import { toDataFrame, FieldType } from '@grafana/data';
import { FrameGeometrySourceMode } from '@grafana/schema';

import {
  getDefaultLocationMatchers,
  getGeometryField,
  getLocationFields,
  getLocationMatchers,
  type LocationFieldMatchers,
} from './location';

const longitude = [0, -74.1];
const latitude = [0, 40.7];
const geohash = ['9q94r', 'dr5rs'];
const names = ['A', 'B'];

/** WGS84 [lon, lat] pairs for `geohash` column values above — stable `toEqual` target (see location.ts + geohash decode). */
const EXPECTED_WGS84_FROM_GEOHASH_FIELDS = [
  [-122.01416015625001, 36.979980468750014],
  [-73.98193359375, 40.71533203125],
] as const;

/** WGS84 [lon, lat] pairs for the shared `latitude` / `longitude` (or aliases) column values above. */
const EXPECTED_WGS84_FROM_LAT_LON_FIELDS = [
  [0, 0],
  [-74.1, 40.69999999999999],
] as const;
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

describe('handle location parsing', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(geojsonObject),
    } as unknown as Response);
  });

  it('auto should find geohash field', async () => {
    const frame = toDataFrame({
      name: 'simple',
      fields: [
        { name: 'name', type: FieldType.string, values: names },
        { name: 'geohash', type: FieldType.number, values: geohash },
      ],
    });

    const matchers = await getLocationMatchers({ mode: FrameGeometrySourceMode.Auto });
    const fields = getLocationFields(frame, matchers);
    expect(fields.mode).toEqual(FrameGeometrySourceMode.Geohash);
    expect(fields.geohash).toBeDefined();
    expect(fields.geohash?.name).toEqual('geohash');

    const info = getGeometryField(frame, matchers);
    expect(info.field!.type).toBe(FieldType.geo);
    expect(info.field!.values.map((p) => toLonLat((p as Point).getCoordinates()))).toEqual(
      EXPECTED_WGS84_FROM_GEOHASH_FIELDS
    );
  });

  it('auto should find coordinate fields', async () => {
    const frame = toDataFrame({
      name: 'simple',
      fields: [
        { name: 'name', type: FieldType.string, values: names },
        { name: 'latitude', type: FieldType.number, values: latitude },
        { name: 'longitude', type: FieldType.number, values: longitude },
      ],
    });

    const matchers = await getLocationMatchers();
    const geo = getGeometryField(frame, matchers).field!;
    expect(geo.values.map((p) => toLonLat((p as Point).getCoordinates()))).toEqual(EXPECTED_WGS84_FROM_LAT_LON_FIELDS);
  });

  it('auto should find coordinate fields using lat and lon aliases', async () => {
    const frame = toDataFrame({
      name: 'simple',
      fields: [
        { name: 'name', type: FieldType.string, values: names },
        { name: 'lat', type: FieldType.number, values: latitude },
        { name: 'lon', type: FieldType.number, values: longitude },
      ],
    });

    const matchers = await getLocationMatchers({ mode: FrameGeometrySourceMode.Auto });
    const fields = getLocationFields(frame, matchers);
    expect(fields.mode).toEqual(FrameGeometrySourceMode.Coords);
    expect(fields.latitude?.name).toEqual('lat');
    expect(fields.longitude?.name).toEqual('lon');

    const geo = getGeometryField(frame, matchers).field!;
    expect(geo.values.map((p) => toLonLat((p as Point).getCoordinates()))).toEqual(EXPECTED_WGS84_FROM_LAT_LON_FIELDS);
  });

  it('auto should find coordinate fields using lng alias for longitude', async () => {
    const frame = toDataFrame({
      name: 'simple',
      fields: [
        { name: 'lat', type: FieldType.number, values: latitude },
        { name: 'lng', type: FieldType.number, values: longitude },
      ],
    });

    const matchers = await getLocationMatchers({ mode: FrameGeometrySourceMode.Auto });
    const fields = getLocationFields(frame, matchers);
    expect(fields.mode).toEqual(FrameGeometrySourceMode.Coords);
    expect(fields.latitude?.name).toEqual('lat');
    expect(fields.longitude?.name).toEqual('lng');

    const geo = getGeometryField(frame, matchers).field!;
    expect(geo.values.map((p) => toLonLat((p as Point).getCoordinates()))).toEqual(EXPECTED_WGS84_FROM_LAT_LON_FIELDS);
  });

  it('auto should find lookup field when latitude, geohash, and geo fields are absent', async () => {
    const frame = toDataFrame({
      fields: [
        { name: 'gdp', type: FieldType.number, values: [1, 2] },
        { name: 'lookup', type: FieldType.string, values: ['MEX', 'USA'] },
      ],
    });

    const matchers = await getLocationMatchers({ mode: FrameGeometrySourceMode.Auto });
    const fields = getLocationFields(frame, matchers);
    expect(fields.mode).toEqual(FrameGeometrySourceMode.Lookup);
    expect(fields.lookup?.name).toEqual('lookup');
  });

  it('auto should find geohash field when values are strings', async () => {
    const frame = toDataFrame({
      name: 'simple',
      fields: [
        { name: 'name', type: FieldType.string, values: names },
        { name: 'geohash', type: FieldType.string, values: ['9q94r', 'dr5rs'] },
      ],
    });

    const matchers = await getLocationMatchers({
      mode: FrameGeometrySourceMode.Auto,
    });
    const geo = getGeometryField(frame, matchers).field!;
    expect(geo.values.map((p) => toLonLat((p as Point).getCoordinates()))).toEqual(EXPECTED_WGS84_FROM_GEOHASH_FIELDS);
  });
});

describe('getDefaultLocationMatchers', () => {
  it('runs synchronously with Auto mode and working field finders', () => {
    const matchers = getDefaultLocationMatchers();
    expect(matchers.mode).toBe(FrameGeometrySourceMode.Auto);

    const frame = toDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: latitude },
        { name: 'lng', type: FieldType.number, values: longitude },
      ],
    });
    expect(matchers.latitude(frame)?.name).toBe('lat');
    expect(matchers.longitude(frame)?.name).toBe('lng');
    expect(matchers.gazetteer).toBeUndefined();
  });
});

describe('getLocationMatchers manual modes', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(geojsonObject),
    } as unknown as Response);
  });

  const geohashFrame = toDataFrame({ fields: [{ name: 'gh', type: FieldType.string, values: ['9q94r'] }] });
  const coordsFrame = toDataFrame({
    fields: [
      { name: 'myLat', type: FieldType.number, values: [1] },
      { name: 'myLon', type: FieldType.number, values: [2] },
    ],
  });
  const lookupFrame = toDataFrame({ fields: [{ name: 'country', type: FieldType.string, values: ['USA'] }] });

  it('resolves gazetteer for every mode', async () => {
    const matchers = await getLocationMatchers({ mode: FrameGeometrySourceMode.Lookup });
    expect(matchers.gazetteer).toBeDefined();
  });

  it('Geohash mode uses the named field, or finds nothing when unset', async () => {
    const named = await getLocationMatchers({ mode: FrameGeometrySourceMode.Geohash, geohash: 'gh' });
    expect(named.geohash(geohashFrame)?.name).toBe('gh');

    const unset = await getLocationMatchers({ mode: FrameGeometrySourceMode.Geohash });
    expect(unset.geohash(geohashFrame)).toBeUndefined();
  });

  it('Coords mode uses the named fields, or finds nothing when unset', async () => {
    const named = await getLocationMatchers({
      mode: FrameGeometrySourceMode.Coords,
      latitude: 'myLat',
      longitude: 'myLon',
    });
    expect(named.latitude(coordsFrame)?.name).toBe('myLat');
    expect(named.longitude(coordsFrame)?.name).toBe('myLon');

    const unset = await getLocationMatchers({ mode: FrameGeometrySourceMode.Coords });
    expect(unset.latitude(coordsFrame)).toBeUndefined();
    expect(unset.longitude(coordsFrame)).toBeUndefined();
  });

  it('Lookup mode uses the named field, falling back to the first string field', async () => {
    const named = await getLocationMatchers({ mode: FrameGeometrySourceMode.Lookup, lookup: 'country' });
    expect(named.lookup(lookupFrame)?.name).toBe('country');

    const byType = await getLocationMatchers({ mode: FrameGeometrySourceMode.Lookup });
    expect(byType.lookup(lookupFrame)?.name).toBe('country');
  });
});

describe('getLocationFields explicit modes', () => {
  it('resolves fields for explicit Coords mode', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: latitude },
        { name: 'lng', type: FieldType.number, values: longitude },
      ],
    });
    const matchers: LocationFieldMatchers = { ...getDefaultLocationMatchers(), mode: FrameGeometrySourceMode.Coords };
    const fields = getLocationFields(frame, matchers);
    expect(fields.mode).toBe(FrameGeometrySourceMode.Coords);
    expect(fields.latitude?.name).toBe('lat');
    expect(fields.longitude?.name).toBe('lng');
  });

  it('returns empty mappings when Auto mode matches nothing', () => {
    const frame = toDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1] }] });
    const fields = getLocationFields(frame, getDefaultLocationMatchers());
    expect(fields.mode).toBe(FrameGeometrySourceMode.Auto);
    expect(fields.geo).toBeUndefined();
    expect(fields.latitude).toBeUndefined();
    expect(fields.geohash).toBeUndefined();
    expect(fields.lookup).toBeUndefined();
  });
});

describe('getGeometryField warnings', () => {
  const emptyFrame = toDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1] }] });
  const stringFrame = toDataFrame({ fields: [{ name: 'lookup', type: FieldType.string, values: ['USA'] }] });

  it('warns when Auto mode cannot find any location fields', () => {
    const result = getGeometryField(emptyFrame, getDefaultLocationMatchers());
    expect(result.field).toBeUndefined();
    expect(result.warning).toBe('Unable to find location fields');
  });

  it('warns when Coords mode is missing latitude/longitude', () => {
    const matchers: LocationFieldMatchers = {
      ...getDefaultLocationMatchers(),
      mode: FrameGeometrySourceMode.Coords,
      latitude: () => undefined,
      longitude: () => undefined,
    };
    const result = getGeometryField(emptyFrame, matchers);
    expect(result.field).toBeUndefined();
    expect(result.warning).toBe('Select latitude/longitude fields');
  });

  it('warns when Geohash mode is missing a geohash field', () => {
    const matchers: LocationFieldMatchers = {
      ...getDefaultLocationMatchers(),
      mode: FrameGeometrySourceMode.Geohash,
      geohash: () => undefined,
    };
    const result = getGeometryField(emptyFrame, matchers);
    expect(result.field).toBeUndefined();
    expect(result.warning).toBe('Select geohash field');
  });

  it('warns when a lookup field is present but no gazetteer is configured', () => {
    const matchers: LocationFieldMatchers = {
      ...getDefaultLocationMatchers(),
      mode: FrameGeometrySourceMode.Lookup,
      lookup: (frame) => frame.fields[0],
      gazetteer: undefined,
    };
    const result = getGeometryField(stringFrame, matchers);
    expect(result.field).toBeUndefined();
    expect(result.warning).toBe('Gazetteer not found');
  });

  it('warns when Lookup mode is missing a lookup field', () => {
    const matchers: LocationFieldMatchers = {
      ...getDefaultLocationMatchers(),
      mode: FrameGeometrySourceMode.Lookup,
      lookup: () => undefined,
    };
    const result = getGeometryField(emptyFrame, matchers);
    expect(result.field).toBeUndefined();
    expect(result.warning).toBe('Select lookup field');
  });
});
