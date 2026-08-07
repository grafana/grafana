import { lastValueFrom, of } from 'rxjs';

import { DataTransformerID, toDataFrame, FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { frameAsGazetter } from 'app/features/geo/gazetteer/gazetteer';

import countriesJSON from '../../../../gazetteer/countries.json';

import { addFieldsFromGazetteer, fieldLookupTransformer } from './fieldLookup';

// Jest is not configured to restore mocks between tests, so each spy below has to be undone
// here or it leaks into the following describe blocks.
afterEach(() => {
  jest.restoreAllMocks();
});

describe('Lookup gazetteer from the worldmap format', () => {
  const publicPath = window.__grafana_public_path__;

  beforeAll(() => {
    window.__grafana_public_path__ = 'https://grafana.fake/public/';
  });

  afterAll(() => {
    window.__grafana_public_path__ = publicPath;
  });

  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(countriesJSON),
    } as unknown as Response);
  });

  it('adds country fields using the default countries gazetteer', async () => {
    const data = toDataFrame({
      name: 'countries',
      fields: [{ name: 'code2letters', type: FieldType.string, values: ['FR'] }],
    });

    const operator = fieldLookupTransformer.operator({ lookupField: 'code2letters' }, { interpolate: (v) => v });
    const out = await lastValueFrom(of([data]).pipe(operator));

    expect(out[0].fields.map((f) => [f.name, f.values])).toEqual([
      ['code2letters', ['FR']],
      ['id', ['FR']],
      ['name', ['France']],
      ['lng', [2.213749]],
      ['lat', [46.227638]],
    ]);
  });
});

describe('Lookup gazetteer error handling', () => {
  it('rejects with an error naming the gazetteer that could not be loaded', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    const data = toDataFrame({
      fields: [{ name: 'code2letters', type: FieldType.string, values: ['FR'] }],
    });

    const operator = fieldLookupTransformer.operator(
      { lookupField: 'code2letters', gazetteer: 'https://example.com/broken.json' },
      { interpolate: (v) => v }
    );

    await expect(lastValueFrom(of([data]).pipe(operator))).rejects.toThrow(/broken\.json/);
  });
});

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

  it('does not look up more values than the frame has rows', () => {
    const data = toDataFrame({
      name: 'countries',
      fields: [{ name: 'code2letters', type: FieldType.string, values: ['FR'] }],
    });

    const matcher = fieldMatchers.get(FieldMatcherID.byName).get('code2letters');

    const frame = toDataFrame({
      fields: [
        { name: 'id', values: ['FR', 'DE', 'ES'] },
        { name: 'name', values: ['France', 'Germany', 'Spain'] },
        { name: 'lng', values: [2.2137, 10.4515, -3.7492] },
        { name: 'lat', values: [46.2276, 51.1657, 40.4637] },
      ],
    });
    const gaz = frameAsGazetter(frame, { path: 'path/to/gaz.json' });
    const find = jest.spyOn(gaz, 'find');

    const out = addFieldsFromGazetteer([data], gaz, matcher)[0];

    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith('FR');

    expect(out.length).toBe(1);
    for (const field of out.fields) {
      expect(field.values).toHaveLength(1);
    }
    expect(out.fields.map((f) => [f.name, f.values])).toEqual([
      ['code2letters', ['FR']],
      ['id', ['FR']],
      ['name', ['France']],
      ['lng', [2.2137]],
      ['lat', [46.2276]],
    ]);
  });

  it('looks up rows past the number of gazetteer entries', () => {
    const data = toDataFrame({
      name: 'locations',
      fields: [
        { name: 'location', type: FieldType.string, values: ['AL', 'AK', 'AZ', 'CA'] },
        { name: 'values', type: FieldType.number, values: [0, 10, 5, 1] },
      ],
    });

    const matcher = fieldMatchers.get(FieldMatcherID.byName).get('location');

    const frame = toDataFrame({
      fields: [
        { name: 'id', values: ['CA', 'AL'] },
        { name: 'name', values: ['California', 'Alabama'] },
      ],
    });
    const gaz = frameAsGazetter(frame, { path: 'path/to/gaz.json' });

    const out = addFieldsFromGazetteer([data], gaz, matcher)[0];

    // 'CA' is row 3, past the 2 gazetteer entries, and must still be looked up
    expect(out.fields.map((f) => [f.name, f.values])).toEqual([
      ['location', ['AL', 'AK', 'AZ', 'CA']],
      ['id', ['AL', undefined, undefined, 'CA']],
      ['name', ['Alabama', undefined, undefined, 'California']],
      ['values', [0, 10, 5, 1]],
    ]);
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
