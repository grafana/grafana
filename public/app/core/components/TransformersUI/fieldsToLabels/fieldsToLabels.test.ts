import { FieldType, toDataFrame } from '@grafana/data';
import { fieldsToLabels } from './fieldsToLabels';

describe('Fields to labels', () => {
  it('separates a single frame into multiple', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
          { name: 'Region', type: FieldType.string, values: ['US', 'EU', 'US', 'EU'] },
          { name: 'Value', type: FieldType.number, values: [1, 2, 3, 4] },
        ],
      }),
    ];

    const result = fieldsToLabels({ labelFields: ['Region'] }, input);

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": Object {
                "Region": "US",
              },
              "name": "Time",
              "type": "time",
              "values": Array [
                1000,
                2000,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "Region": "US",
              },
              "name": "Value",
              "type": "number",
              "values": Array [
                1,
                3,
              ],
            },
          ],
          "meta": undefined,
          "name": undefined,
          "refId": undefined,
        },
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": Object {
                "Region": "EU",
              },
              "name": "Time",
              "type": "time",
              "values": Array [
                1000,
                2000,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "Region": "EU",
              },
              "name": "Value",
              "type": "number",
              "values": Array [
                2,
                4,
              ],
            },
          ],
          "meta": undefined,
          "name": undefined,
          "refId": undefined,
        },
      ]
    `);
  });

  it('passes through other labels', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
          { name: 'Region', type: FieldType.string, values: ['US', 'EU', 'US', 'EU'] },
          { name: 'Value', type: FieldType.number, values: [1, 2, 3, 4], labels: { Environment: 'Production' } },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 2000] },
          { name: 'Region', type: FieldType.string, values: ['US', 'US'] },
          { name: 'Value', type: FieldType.number, values: [5, 6], labels: { Environment: 'Staging' } },
        ],
      }),
    ];

    const result = fieldsToLabels({ labelFields: ['Region'] }, input);

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": Object {
                "Environment": "Production",
                "Region": "US",
              },
              "name": "Time",
              "type": "time",
              "values": Array [
                1000,
                2000,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "Environment": "Production",
                "Region": "US",
              },
              "name": "Value",
              "type": "number",
              "values": Array [
                1,
                3,
              ],
            },
          ],
          "meta": undefined,
          "name": undefined,
          "refId": undefined,
        },
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": Object {
                "Environment": "Production",
                "Region": "EU",
              },
              "name": "Time",
              "type": "time",
              "values": Array [
                1000,
                2000,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "Environment": "Production",
                "Region": "EU",
              },
              "name": "Value",
              "type": "number",
              "values": Array [
                2,
                4,
              ],
            },
          ],
          "meta": undefined,
          "name": undefined,
          "refId": undefined,
        },
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": Object {
                "Environment": "Staging",
                "Region": "US",
              },
              "name": "Time",
              "type": "time",
              "values": Array [
                1000,
                2000,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "Environment": "Staging",
                "Region": "US",
              },
              "name": "Value",
              "type": "number",
              "values": Array [
                5,
                6,
              ],
            },
          ],
          "meta": undefined,
          "name": undefined,
          "refId": undefined,
        },
      ]
    `);
  });

  it('works with empty options', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 2000] },
          { name: 'Value', type: FieldType.number, values: [1, 2] },
        ],
      }),
    ];

    const result = fieldsToLabels({}, input);

    expect(result).toEqual(input);
  });
});
