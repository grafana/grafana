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
      {
        "fields": [
          {
            "config": {},
            "name": "id",
            "type": "string",
          },
          {
            "config": {},
            "name": "geo",
            "type": "geo",
          },
          {
            "config": {},
            "name": "hello",
            "type": "string",
          },
          {
            "config": {},
            "name": "number",
            "type": "number",
          },
          {
            "config": {},
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
      frame.fields.reduce<Record<string, unknown[]>>((acc, v, idx, arr) => {
        if (v.type !== FieldType.geo) {
          acc[v.name] = v.values.toArray();
        }
        return acc;
      }, {})
    ).toMatchInlineSnapshot(`
      {
        "hello": [
          "A",
          "B",
          null,
        ],
        "id": [
          "A",
          null,
          null,
        ],
        "mixed": [
          null,
          "first",
          "2",
        ],
        "number": [
          null,
          1.2,
          2.3,
        ],
      }
    `);
  });
});
