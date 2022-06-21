import { dataFrameToJSON, FieldType } from '@grafana/data';

import { frameFromGeoJSON } from './geojson';

describe('Read GeoJSON', () => {
  it('supports simple read', () => {
    const frame = frameFromGeoJSON({
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
            number: 1.2,
            hello: 'B',
            mixed: 'first',
          },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [2, 2],
          },
          properties: {
            number: 2.3,
            mixed: 2,
          },
        },
      ],
    });
    const msg = dataFrameToJSON(frame);
    expect(msg.schema).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "name": "id",
            "type": "string",
          },
          Object {
            "config": Object {},
            "name": "geo",
            "type": "geo",
          },
          Object {
            "config": Object {},
            "name": "hello",
            "type": "string",
          },
          Object {
            "config": Object {},
            "name": "number",
            "type": "number",
          },
          Object {
            "config": Object {},
            "name": "mixed",
            "type": "string",
          },
        ],
        "meta": undefined,
        "name": undefined,
        "refId": undefined,
      }
    `);

    expect(
      frame.fields.reduce((acc, v, idx, arr) => {
        if (v.type !== FieldType.geo) {
          acc[v.name] = v.values.toArray();
        }
        return acc;
      }, {} as any)
    ).toMatchInlineSnapshot(`
      Object {
        "hello": Array [
          "A",
          "B",
          null,
        ],
        "id": Array [
          "A",
          null,
          null,
        ],
        "mixed": Array [
          null,
          "first",
          "2",
        ],
        "number": Array [
          null,
          1.2,
          2.3,
        ],
      }
    `);
  });
});
