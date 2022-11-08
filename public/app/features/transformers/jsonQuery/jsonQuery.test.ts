import { DataFrame, ArrayVector, FieldType } from '@grafana/data';

import { jsonQueryTransformer } from './jsonQuery';
import { JSONQueryOptions } from './types';

describe('Extract Path from JSON', () => {
  it('Path $', async () => {
    const cfg: JSONQueryOptions = {
      source: 'samples',
    };

    const frames = jsonQueryTransformer.transformer(cfg)([jsonTestObject]);
    expect(frames.length).toEqual(1);
    expect(frames[0].fields.length).toEqual(1);
    expect(frames).toMatchInlineSnapshot(`
      Array [
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "name": "Value_0",
              "type": "string",
              "values": Array [
                Object {
                  "flag": true,
                  "nestedObject": Object {
                    "nestedNumberArray": Array [
                      1,
                      2,
                      3,
                    ],
                    "nestedObjectArray": Array [
                      Object {
                        "data": 1,
                      },
                      Object {
                        "data": 2,
                      },
                      Object {
                        "data": 3,
                      },
                    ],
                    "nestedStringArray": Array [
                      "1",
                      "2",
                      "3",
                    ],
                  },
                  "numberArray": Array [
                    1,
                    2,
                    3,
                  ],
                  "objectArray": Array [
                    Object {
                      "data": 1,
                    },
                    Object {
                      "data": 2,
                    },
                    Object {
                      "data": 3,
                    },
                  ],
                  "stringArray": Array [
                    "1",
                    "2",
                    "3",
                  ],
                  "timestamp": "2022-11-08T09:05:50.989654408Z",
                },
                Object {
                  "flag": true,
                  "nestedObject": Object {
                    "nestedNumberArray": Array [
                      4,
                      5,
                      6,
                    ],
                    "nestedObjectArray": Array [
                      Object {
                        "data": 4,
                      },
                      Object {
                        "data": 5,
                      },
                      Object {
                        "data": 6,
                      },
                    ],
                    "nestedStringArray": Array [
                      "4",
                      "5",
                      "6",
                    ],
                  },
                  "numberArray": Array [
                    4,
                    5,
                    6,
                  ],
                  "objectArray": Array [
                    Object {
                      "data": 4,
                    },
                    Object {
                      "data": 5,
                    },
                    Object {
                      "data": 6,
                    },
                  ],
                  "stringArray": Array [
                    "4",
                    "5",
                    "6",
                  ],
                  "timestamp": "2022-11-08T09:05:51.989654408Z",
                },
              ],
            },
          ],
          "length": 2,
        },
      ]
    `);
  });

  it('Path $.[*].timestamp', async () => {
    const cfg: JSONQueryOptions = {
      source: 'samples',
      query: '$.[*].timestamp',
    };

    const frames = jsonQueryTransformer.transformer(cfg)([jsonTestObject]);
    expect(frames.length).toEqual(1);
    expect(frames[0].fields.length).toEqual(2);
    expect(frames).toMatchInlineSnapshot(`
      Array [
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "name": "timestamp_0",
              "type": "time",
              "values": "2022-11-08T09:05:50.989654408Z",
            },
            Object {
              "config": Object {},
              "name": "timestamp_1",
              "type": "time",
              "values": "2022-11-08T09:05:51.989654408Z",
            },
          ],
          "length": 2,
        },
      ]
    `);
  });

  it('Path $.[*].numberArray.[*] with Alias', async () => {
    const cfg: JSONQueryOptions = {
      source: 'samples',
      query: '$.[*].numberArray.[*]',
      alias: 'P',
    };

    const frames = jsonQueryTransformer.transformer(cfg)([jsonTestObject]);
    expect(frames.length).toEqual(1);
    expect(frames[0].fields.length).toEqual(6);
    expect(frames).toMatchInlineSnapshot(`
      Array [
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "name": "P_0",
              "type": "number",
              "values": 1,
            },
            Object {
              "config": Object {},
              "name": "P_1",
              "type": "number",
              "values": 2,
            },
            Object {
              "config": Object {},
              "name": "P_2",
              "type": "number",
              "values": 3,
            },
            Object {
              "config": Object {},
              "name": "P_3",
              "type": "number",
              "values": 4,
            },
            Object {
              "config": Object {},
              "name": "P_4",
              "type": "number",
              "values": 5,
            },
            Object {
              "config": Object {},
              "name": "P_5",
              "type": "number",
              "values": 6,
            },
          ],
          "length": 2,
        },
      ]
    `);
  });

  it('Path $.[*].nestedObject.nestedStringArray', async () => {
    const cfg: JSONQueryOptions = {
      source: 'samples',
      query: '$.[*].nestedObject.nestedStringArray',
      type: FieldType.string,
    };

    const frames = jsonQueryTransformer.transformer(cfg)([jsonTestObject]);
    expect(frames.length).toEqual(1);
    expect(frames[0].fields.length).toEqual(2);
    expect(frames).toMatchInlineSnapshot(`
      Array [
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "name": "nestedStringArray_0",
              "type": "string",
              "values": Array [
                "1",
                "2",
                "3",
              ],
            },
            Object {
              "config": Object {},
              "name": "nestedStringArray_1",
              "type": "string",
              "values": Array [
                "4",
                "5",
                "6",
              ],
            },
          ],
          "length": 2,
        },
      ]
    `);
  });
});

const jsonTestObject: DataFrame = {
  fields: [
    {
      name: 'samples',
      type: FieldType.other,
      config: {},
      values: new ArrayVector([
        {
          timestamp: '2022-11-08T09:05:50.989654408Z',
          flag: true,
          numberArray: [1, 2, 3],
          stringArray: ['1', '2', '3'],
          objectArray: [{ data: 1 }, { data: 2 }, { data: 3 }],
          nestedObject: {
            nestedNumberArray: [1, 2, 3],
            nestedStringArray: ['1', '2', '3'],
            nestedObjectArray: [{ data: 1 }, { data: 2 }, { data: 3 }],
          },
        },
        {
          timestamp: '2022-11-08T09:05:51.989654408Z',
          flag: true,
          numberArray: [4, 5, 6],
          stringArray: ['4', '5', '6'],
          objectArray: [{ data: 4 }, { data: 5 }, { data: 6 }],
          nestedObject: {
            nestedNumberArray: [4, 5, 6],
            nestedStringArray: ['4', '5', '6'],
            nestedObjectArray: [{ data: 4 }, { data: 5 }, { data: 6 }],
          },
        },
      ]),
    },
  ],
  length: 2,
};
