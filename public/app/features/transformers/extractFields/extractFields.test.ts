import { DataFrame, Field, FieldType } from '@grafana/data';
import { toDataFrame } from '@grafana/data/src/dataframe/processDataFrame';

import { extractFieldsTransformer } from './extractFields';
import { ExtractFieldsOptions, FieldExtractorID } from './types';

describe('Fields from JSON', () => {
  it('adds fields from JSON in string', async () => {
    const cfg: ExtractFieldsOptions = {
      source: 'line',
      replace: true,
    };
    const ctx = { interpolate: (v: string) => v };
    const data = toDataFrame({
      columns: ['ts', 'line'],
      rows: appl,
    });

    const frames = extractFieldsTransformer.transformer(cfg, ctx)([data]);
    expect(frames.length).toEqual(1);
    expect(
      frames[0].fields.reduce<Record<string, FieldType>>((acc, v) => {
        acc[v.name] = v.type;
        return acc;
      }, {})
    ).toMatchInlineSnapshot(`
      {
        "a": "string",
        "av": "number",
        "c": "string",
        "e": "number",
        "ev": "string",
        "h": "string",
        "l": "string",
        "o": "string",
        "op": "string",
        "s": "number",
        "sym": "string",
        "v": "number",
        "vw": "string",
        "z": "number",
      }
    `);
  });

  it('Get nested path values', () => {
    const cfg: ExtractFieldsOptions = {
      replace: true,
      source: 'JSON',
      format: FieldExtractorID.JSON,
      jsonPaths: [
        { path: 'object.nestedArray[0]' },
        { path: 'object.nestedArray[1]' },
        { path: 'object.nestedString' },
      ],
    };
    const ctx = { interpolate: (v: string) => v };

    const frames = extractFieldsTransformer.transformer(cfg, ctx)([testDataFrame]);
    expect(frames.length).toEqual(1);
    expect(frames[0]).toMatchInlineSnapshot(`
      {
        "fields": [
          {
            "config": {},
            "name": "object.nestedArray[0]",
            "type": "number",
            "values": [
              1,
            ],
          },
          {
            "config": {},
            "name": "object.nestedArray[1]",
            "type": "number",
            "values": [
              2,
            ],
          },
          {
            "config": {},
            "name": "object.nestedString",
            "type": "string",
            "values": [
              "Hallo World",
            ],
          },
        ],
        "length": 1,
      }
    `);
  });

  it('Keep time field on replace', () => {
    const cfg: ExtractFieldsOptions = {
      replace: true,
      keepTime: true,
      source: 'JSON',
      format: FieldExtractorID.JSON,
      jsonPaths: [
        { path: 'object.nestedArray[2]' },
        { path: 'object.nestedArray[3]' },
        { path: 'object.nestedString' },
      ],
    };
    const ctx = { interpolate: (v: string) => v };

    const frames = extractFieldsTransformer.transformer(cfg, ctx)([testDataFrame]);
    expect(frames.length).toEqual(1);
    expect(frames[0]).toMatchInlineSnapshot(`
      {
        "fields": [
          {
            "config": {},
            "name": "Time",
            "state": {
              "displayName": "Time",
              "multipleFrames": false,
            },
            "type": "time",
            "values": [
              1669638911691,
            ],
          },
          {
            "config": {},
            "name": "object.nestedArray[2]",
            "type": "number",
            "values": [
              3,
            ],
          },
          {
            "config": {},
            "name": "object.nestedArray[3]",
            "type": "number",
            "values": [
              4,
            ],
          },
          {
            "config": {},
            "name": "object.nestedString",
            "type": "string",
            "values": [
              "Hallo World",
            ],
          },
        ],
        "length": 1,
      }
    `);
  });

  it('Path is invalid', () => {
    const cfg: ExtractFieldsOptions = {
      replace: true,
      source: 'JSON',
      format: FieldExtractorID.JSON,
      jsonPaths: [{ path: 'object.nestedString' }, { path: 'invalid.path' }],
    };
    const ctx = { interpolate: (v: string) => v };

    const frames = extractFieldsTransformer.transformer(cfg, ctx)([testDataFrame]);
    expect(frames.length).toEqual(1);
    expect(frames[0]).toMatchInlineSnapshot(`
      {
        "fields": [
          {
            "config": {},
            "name": "object.nestedString",
            "type": "string",
            "values": [
              "Hallo World",
            ],
          },
          {
            "config": {},
            "name": "invalid.path",
            "type": "string",
            "values": [
              "Not Found",
            ],
          },
        ],
        "length": 1,
      }
    `);
  });
});

const testFieldTime: Field = {
  config: {},
  name: 'Time',
  type: FieldType.time,
  values: [1669638911691],
};

const testFieldString: Field = {
  config: {},
  name: 'String',
  type: FieldType.string,
  values: ['Hallo World'],
};

const testFieldJSON: Field = {
  config: {},
  name: 'JSON',
  type: FieldType.string,
  values: [
    JSON.stringify({
      object: {
        nestedArray: [1, 2, 3, 4],
        nestedString: 'Hallo World',
      },
    }),
  ],
};

const testDataFrame: DataFrame = {
  fields: [testFieldTime, testFieldString, testFieldJSON],
  length: 1,
};

const appl = [
  [
    '1636678740000000000',
    '{"a":"148.1673","av":41941752,"c":"148.25","e":1636678800000,"ev":"AM","h":"148.28","l":"148.22","o":"148.25","op":"148.96","s":1636678740000,"sym":"AAPL","v":2903,"vw":"148.2545","z":152}',
  ],
  [
    '1636678680000000000',
    '{"a":"148.1673","av":41938849,"c":"148.25","e":1636678740000,"ev":"AM","h":"148.27","l":"148.25","o":"148.26","op":"148.96","s":1636678680000,"sym":"AAPL","v":7589,"vw":"148.2515","z":329}',
  ],
  [
    '1636678620000000000',
    '{"a":"148.1672","av":41931260,"c":"148.27","e":1636678680000,"ev":"AM","h":"148.27","l":"148.25","o":"148.27","op":"148.96","s":1636678620000,"sym":"AAPL","v":6138,"vw":"148.2541","z":245}',
  ],
  [
    '1636678560000000000',
    '{"a":"148.1672","av":41925122,"c":"148.28","e":1636678620000,"ev":"AM","h":"148.29","l":"148.27","o":"148.27","op":"148.96","s":1636678560000,"sym":"AAPL","v":1367,"vw":"148.2816","z":56}',
  ],
  [
    '1636678500000000000',
    '{"a":"148.1672","av":41923755,"c":"148.25","e":1636678560000,"ev":"AM","h":"148.27","l":"148.25","o":"148.25","op":"148.96","s":1636678500000,"sym":"AAPL","v":556,"vw":"148.2539","z":55}',
  ],
  [
    '1636678440000000000',
    '{"a":"148.1672","av":41923199,"c":"148.28","e":1636678500000,"ev":"AM","h":"148.28","l":"148.25","o":"148.25","op":"148.96","s":1636678440000,"sym":"AAPL","v":451,"vw":"148.2614","z":56}',
  ],
  [
    '1636678380000000000',
    '{"a":"148.1672","av":41922748,"c":"148.24","e":1636678440000,"ev":"AM","h":"148.24","l":"148.24","o":"148.24","op":"148.96","s":1636678380000,"sym":"AAPL","v":344,"vw":"148.2521","z":24}',
  ],
  [
    '1636678320000000000',
    '{"a":"148.1672","av":41922404,"c":"148.28","e":1636678380000,"ev":"AM","h":"148.28","l":"148.24","o":"148.24","op":"148.96","s":1636678320000,"sym":"AAPL","v":705,"vw":"148.2543","z":64}',
  ],
  [
    '1636678260000000000',
    '{"a":"148.1672","av":41921699,"c":"148.25","e":1636678320000,"ev":"AM","h":"148.25","l":"148.25","o":"148.25","op":"148.96","s":1636678260000,"sym":"AAPL","v":1054,"vw":"148.2513","z":131}',
  ],
];
