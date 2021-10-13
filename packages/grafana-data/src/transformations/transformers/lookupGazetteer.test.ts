import { FieldType, transformDataFrame } from '@grafana/data';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { DataTransformerID } from './ids';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { lookupGazetteerTransformer } from './lookupGazetteer';

describe('Lookup gazetteer location', () => {
  beforeAll(() => {
    mockTransformationsRegistry([lookupGazetteerTransformer]);
  });

  it('can add location based on string field', async () => {
    const cfg = {
      id: DataTransformerID.lookupGazetteer,
      options: {
        mappingField: 'location',
        lookupField: 'id',
      },
    };
    const data = toDataFrame({
      name: 'locations',
      fields: [
        { name: 'location', type: FieldType.string, values: ['AL', 'AK', 'Arizona', 'Arkansas', 'Zimbabwe'] },
        { name: 'values', type: FieldType.number, values: [0, 10, 5, 1, 5] },
      ],
    });

    await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((res) => {
      const data = res[0];

      console.log('data', data[0]);
      expect(data[0]).toMatchInlineSnapshot(`
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
                "Zimbabwe",
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
            Object {
              "config": Object {},
              "name": "matched",
              "state": Object {
                "displayName": "matched",
              },
              "type": "string",
              "values": Array [
                Object {
                  "coordinates": Array [
                    Array [
                      Array [
                        -87.359296,
                        35.00118,
                      ],
                      Array [
                        -85.606675,
                        34.984749,
                      ],
                      Array [
                        -85.431413,
                        34.124869,
                      ],
                    ],
                  ],
                  "type": "Polygon",
                },
                Object {
                  "coordinates": Array [
                    Array [
                      Array [
                        Array [
                          -131.602021,
                          55.117982,
                        ],
                        Array [
                          -131.569159,
                          55.28229,
                        ],
                        Array [
                          -131.355558,
                          55.183705,
                        ],
                      ],
                    ],
                    Array [
                      Array [
                        Array [
                          -131.832052,
                          55.42469,
                        ],
                        Array [
                          -131.645836,
                          55.304197,
                        ],
                        Array [
                          -131.749898,
                          55.128935,
                        ],
                      ],
                    ],
                    Array [
                      Array [
                        Array [
                          -132.976733,
                          56.437924,
                        ],
                        Array [
                          -132.735747,
                          56.459832,
                        ],
                        Array [
                          -132.631685,
                          56.421493,
                        ],
                      ],
                    ],
                  ],
                  "type": "MultiPolygon",
                },
                null,
                null,
                null,
              ],
            },
          ],
          "first": Array [
            "AL",
            "AK",
            "Arizona",
            "Arkansas",
            "Zimbabwe",
          ],
          "length": 5,
          "meta": Object {
            "transformations": Array [
              "lookupGazetteer",
            ],
          },
          "name": "locations",
        }
      `);
    });
  });
});
