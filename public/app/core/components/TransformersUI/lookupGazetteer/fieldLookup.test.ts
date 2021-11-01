import { FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { toDataFrame } from '@grafana/data/src/dataframe/processDataFrame';
import { DataTransformerID } from '@grafana/data/src/transformations/transformers/ids';
import { Gazetteer } from 'app/plugins/panel/geomap/gazetteer/gazetteer';
import { addFieldsFromGazetteer } from './fieldLookup';

describe('Lookup gazetteer', () => {
  it('adds lat/lon based on string field', async () => {
    const cfg = {
      id: DataTransformerID.fieldLookup,
      options: {
        lookupField: 'location',
        gazetteer: 'public/gazetteer/usa-states.json',
      },
    };
    const data = toDataFrame({
      name: 'locations',
      fields: [
        { name: 'location', type: FieldType.string, values: ['AL', 'AK', 'Arizona', 'Arkansas', 'Somewhere'] },
        { name: 'values', type: FieldType.number, values: [0, 10, 5, 1, 5] },
      ],
    });

    const matcher = fieldMatchers.get(FieldMatcherID.byName).get(cfg.options?.lookupField);

    const values = new Map()
      .set('AL', { name: 'Alabama', id: 'AL', coords: [-80.891064, 12.448457] })
      .set('AK', { name: 'Arkansas', id: 'AK', coords: [-100.891064, 24.448457] })
      .set('AZ', { name: 'Arizona', id: 'AZ', coords: [-111.891064, 33.448457] })
      .set('Arizona', { name: 'Arizona', id: 'AZ', coords: [-111.891064, 33.448457] });

    const gaz: Gazetteer = {
      count: 3,
      examples: () => ['AL', 'AK', 'AZ'],
      find: (k) => {
        let v = values.get(k);
        if (!v && typeof k === 'string') {
          v = values.get(k.toUpperCase());
        }
        return v;
      },
      path: 'public/gazetteer/usa-states.json',
    };

    expect(await addFieldsFromGazetteer([data], gaz, matcher)).toMatchInlineSnapshot(`
      Array [
        Object {
          "creator": [Function],
          "fields": Array [
            Object {
              "config": Object {},
              "name": "location",
              "type": "string",
              "values": Array [
                "AL",
                "AK",
                "Arizona",
                "Arkansas",
                "Somewhere",
              ],
            },
            Object {
              "config": Object {},
              "name": "lon",
              "type": "number",
              "values": Array [
                -80.891064,
                -100.891064,
                -111.891064,
                undefined,
                undefined,
              ],
            },
            Object {
              "config": Object {},
              "name": "lat",
              "type": "number",
              "values": Array [
                12.448457,
                24.448457,
                33.448457,
                undefined,
                undefined,
              ],
            },
            Object {
              "config": Object {},
              "name": "values",
              "state": Object {
                "displayName": "values",
              },
              "type": "number",
              "values": Array [
                0,
                10,
                5,
                1,
                5,
              ],
            },
          ],
          "first": Array [
            "AL",
            "AK",
            "Arizona",
            "Arkansas",
            "Somewhere",
          ],
          "length": 5,
          "name": "locations",
        },
      ]
    `);
  });
});
