import { Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';

import { toDataFrame, FieldType } from '@grafana/data';
import { FrameGeometrySourceMode } from '@grafana/schema';

import { getGeometryField, getLocationFields, getLocationMatchers } from './location';

const longitude = [0, -74.1];
const latitude = [0, 40.7];
const geohash = ['9q94r', 'dr5rs'];
const names = ['A', 'B'];

describe('handle location parsing', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation();
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
    expect(info.field!.values.toArray().map((p) => toLonLat((p as Point).getCoordinates()))).toMatchInlineSnapshot(`
      ArrayVector [
        [
          -122.01416015625001,
          36.979980468750014,
        ],
        [
          -73.98193359375,
          40.71533203125,
        ],
      ]
    `);
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
    expect(geo.values.toArray().map((p) => toLonLat((p as Point).getCoordinates()))).toMatchInlineSnapshot(`
      ArrayVector [
        [
          0,
          0,
        ],
        [
          -74.1,
          40.69999999999999,
        ],
      ]
    `);
  });

  it('auto support geohash fields', async () => {
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
    expect(geo.values.toArray().map((p) => toLonLat((p as Point).getCoordinates()))).toMatchInlineSnapshot(`
      ArrayVector [
        [
          -122.01416015625001,
          36.979980468750014,
        ],
        [
          -73.98193359375,
          40.71533203125,
        ],
      ]
    `);
  });
});
