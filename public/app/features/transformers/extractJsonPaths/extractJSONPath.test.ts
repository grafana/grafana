import { ArrayVector, DataFrame, Field, FieldType } from '@grafana/data';

import { extractJSONPathTransformer } from './extractJSONPath';
import { ExtractJSONPathOptions } from './types';

describe('JSON Paths from value', () => {
  it('Get nested path values', () => {
    const cfg: ExtractJSONPathOptions = {
      replace: true,
      sources: [
        {
          source: 'JSON',
          paths: [
            { path: 'object.nestedArray[0]' },
            { path: 'object.nestedArray[1]' },
            { path: 'object.nestedString' },
          ],
        },
      ],
    };

    const frames = extractJSONPathTransformer.transformer(cfg)([testDataFrame]);
    expect(frames.length).toEqual(1);
    expect(frames[0]).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "name": "object.nestedArray[0]",
            "type": "number",
            "values": Array [
              1,
            ],
          },
          Object {
            "config": Object {},
            "name": "object.nestedArray[1]",
            "type": "number",
            "values": Array [
              2,
            ],
          },
          Object {
            "config": Object {},
            "name": "object.nestedString",
            "type": "string",
            "values": Array [
              "Hallo World",
            ],
          },
        ],
        "length": 1,
      }
    `);
  });

  it('Pass all values via * and just rename via alias', () => {
    const cfg: ExtractJSONPathOptions = {
      replace: true,
      sources: [
        {
          source: 'JSON',
          paths: [{ path: '*', alias: 'AliasJSON' }],
        },
        {
          source: 'Time',
          paths: [{ path: '*', alias: 'AliasTime' }],
        },
        {
          source: 'String',
          paths: [{ path: '*', alias: 'AliasString' }],
        },
      ],
    };

    const frames = extractJSONPathTransformer.transformer(cfg)([testDataFrame]);
    expect(frames.length).toEqual(1);
    expect(frames[0]).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "name": "AliasJSON",
            "type": "string",
            "values": Array [
              "{\\"object\\":{\\"nestedArray\\":[1,2,3,4],\\"nestedString\\":\\"Hallo World\\"}}",
            ],
          },
          Object {
            "config": Object {},
            "name": "AliasTime",
            "type": "number",
            "values": Array [
              1669638911691,
            ],
          },
          Object {
            "config": Object {},
            "name": "AliasString",
            "type": "string",
            "values": Array [
              "Hallo World",
            ],
          },
        ],
        "length": 1,
      }
    `);
  });

  it('Keep time field on replace', () => {
    const cfg: ExtractJSONPathOptions = {
      replace: true,
      keepTime: true,
      sources: [
        {
          source: 'JSON',
          paths: [
            { path: 'object.nestedArray[2]' },
            { path: 'object.nestedArray[3]' },
            { path: 'object.nestedString' },
          ],
        },
      ],
    };

    const frames = extractJSONPathTransformer.transformer(cfg)([testDataFrame]);
    expect(frames.length).toEqual(1);
    expect(frames[0]).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "name": "Time",
            "state": Object {
              "displayName": "Time",
              "multipleFrames": false,
            },
            "type": "time",
            "values": Array [
              1669638911691,
            ],
          },
          Object {
            "config": Object {},
            "name": "object.nestedArray[2]",
            "type": "number",
            "values": Array [
              3,
            ],
          },
          Object {
            "config": Object {},
            "name": "object.nestedArray[3]",
            "type": "number",
            "values": Array [
              4,
            ],
          },
          Object {
            "config": Object {},
            "name": "object.nestedString",
            "type": "string",
            "values": Array [
              "Hallo World",
            ],
          },
        ],
        "length": 1,
      }
    `);
  });

  it('Path is invalid', () => {
    const cfg: ExtractJSONPathOptions = {
      replace: true,
      sources: [
        {
          source: 'JSON',
          paths: [{ path: 'object.nestedString' }, { path: 'invalid.path' }],
        },
      ],
    };

    const frames = extractJSONPathTransformer.transformer(cfg)([testDataFrame]);
    expect(frames.length).toEqual(1);
    expect(frames[0]).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "name": "object.nestedString",
            "type": "string",
            "values": Array [
              "Hallo World",
            ],
          },
          Object {
            "config": Object {},
            "name": "invalid.path",
            "type": "string",
            "values": Array [
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
  values: new ArrayVector([1669638911691]),
};

const testFieldString: Field = {
  config: {},
  name: 'String',
  type: FieldType.string,
  values: new ArrayVector(['Hallo World']),
};

const testFieldJSON: Field = {
  config: {},
  name: 'JSON',
  type: FieldType.string,
  values: new ArrayVector([
    JSON.stringify({
      object: {
        nestedArray: [1, 2, 3, 4],
        nestedString: 'Hallo World',
      },
    }),
  ]),
};

const testDataFrame: DataFrame = {
  fields: [testFieldTime, testFieldString, testFieldJSON],
  length: 1,
};
