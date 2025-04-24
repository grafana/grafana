import { DataTransformerID, toDataFrame, FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { frameAsGazetter } from 'app/features/geo/gazetteer/gazetteer';

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

    const frame = toDataFrame({
      fields: [
        { name: 'id', values: ['AL', 'AK', 'AZ'] },
        { name: 'name', values: ['Alabama', 'Arkansas', 'Arizona'] },
        { name: 'lng', values: [-80.891064, -100.891064, -111.891064] },
        { name: 'lat', values: [12.448457, 24.448457, 33.448457] },
      ],
    });
    const gaz = frameAsGazetter(frame, { path: 'path/to/gaz.json' });
    const out = await addFieldsFromGazetteer([data], gaz, matcher)[0];

    expect(out.fields).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "name": "location",
          "type": "string",
          "values": [
            "AL",
            "AK",
            "Arizona",
            "Arkansas",
            "Somewhere",
          ],
        },
        {
          "config": {},
          "name": "id",
          "type": "string",
          "values": [
            "AL",
            "AK",
            ,
            ,
            ,
          ],
        },
        {
          "config": {},
          "name": "name",
          "type": "string",
          "values": [
            "Alabama",
            "Arkansas",
            ,
            ,
            ,
          ],
        },
        {
          "config": {},
          "name": "lng",
          "type": "number",
          "values": [
            -80.891064,
            -100.891064,
            ,
            ,
            ,
          ],
        },
        {
          "config": {},
          "name": "lat",
          "type": "number",
          "values": [
            12.448457,
            24.448457,
            ,
            ,
            ,
          ],
        },
        {
          "config": {},
          "name": "values",
          "state": {
            "displayName": "values",
            "multipleFrames": false,
          },
          "type": "number",
          "values": [
            0,
            10,
            5,
            1,
            5,
          ],
        },
      ]
    `);
  });

  it('goes through entire gazetteer to find matches', async () => {
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
        {
          name: 'location',
          type: FieldType.string,
          values: ['AL', 'AK', 'Arizona', 'Arkansas', 'Somewhere', 'CO', 'CA'],
        },
        { name: 'values', type: FieldType.number, values: [0, 10, 5, 1, 5, 1, 2] },
      ],
    });

    const matcher = fieldMatchers.get(FieldMatcherID.byName).get(cfg.options?.lookupField);

    const frame = toDataFrame({
      fields: [
        { name: 'id', values: ['AL', 'AK', 'AZ', 'MO', 'CO', 'CA', 'GA'] },
        { name: 'name', values: ['Alabama', 'Arkansas', 'Arizona', 'Missouri', 'Colorado', 'California', 'Georgia'] },
        { name: 'lng', values: [-80.891064, -100.891064, -111.891064, -92.302, -105.3272, -119.7462, -83.6487] },
        { name: 'lat', values: [12.448457, 24.448457, 33.448457, 38.4623, 39.0646, 36.17, 32.9866] },
      ],
    });
    const gaz = frameAsGazetter(frame, { path: 'path/to/gaz.json' });
    const out = await addFieldsFromGazetteer([data], gaz, matcher)[0];

    expect(out.fields).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "name": "location",
          "type": "string",
          "values": [
            "AL",
            "AK",
            "Arizona",
            "Arkansas",
            "Somewhere",
            "CO",
            "CA",
          ],
        },
        {
          "config": {},
          "name": "id",
          "type": "string",
          "values": [
            "AL",
            "AK",
            ,
            ,
            ,
            "CO",
            "CA",
          ],
        },
        {
          "config": {},
          "name": "name",
          "type": "string",
          "values": [
            "Alabama",
            "Arkansas",
            ,
            ,
            ,
            "Colorado",
            "California",
          ],
        },
        {
          "config": {},
          "name": "lng",
          "type": "number",
          "values": [
            -80.891064,
            -100.891064,
            ,
            ,
            ,
            -105.3272,
            -119.7462,
          ],
        },
        {
          "config": {},
          "name": "lat",
          "type": "number",
          "values": [
            12.448457,
            24.448457,
            ,
            ,
            ,
            39.0646,
            36.17,
          ],
        },
        {
          "config": {},
          "name": "values",
          "state": {
            "displayName": "values",
            "multipleFrames": false,
          },
          "type": "number",
          "values": [
            0,
            10,
            5,
            1,
            5,
            1,
            2,
          ],
        },
      ]
    `);
  });
});
