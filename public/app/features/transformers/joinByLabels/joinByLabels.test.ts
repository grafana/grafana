import { toDataFrame, FieldType, DataFrame } from '@grafana/data';

import { joinByLabels } from './joinByLabels';

describe('Join by labels', () => {
  it('Simple join', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2] },
          {
            name: 'Value',
            type: FieldType.number,
            config: {
              displayNameFromDS: '111',
            },
            values: [10, 200],
            labels: { what: 'Temp', cluster: 'A', job: 'J1' },
          },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2] },
          {
            name: 'Value',
            type: FieldType.number,
            config: {
              displayNameFromDS: '222',
            },
            values: [10, 200],
            labels: { what: 'Temp', cluster: 'B', job: 'J1' },
          },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [22, 28] },
          {
            name: 'Value',
            type: FieldType.number,
            config: {
              displayNameFromDS: '333',
            },
            values: [22, 77],
            labels: { what: 'Speed', cluster: 'B', job: 'J1' },
          },
        ],
      }),
    ];

    const result = joinByLabels(
      {
        value: 'what',
      },
      input
    );
    expect(result.fields[result.fields.length - 1].config).toMatchInlineSnapshot(`Object {}`);
    expect(toRowsSnapshow(result)).toMatchInlineSnapshot(`
      Object {
        "columns": Array [
          "cluster",
          "job",
          "Temp",
          "Speed",
        ],
        "rows": Array [
          Array [
            "A",
            "J1",
            10,
            undefined,
          ],
          Array [
            "A",
            "J1",
            200,
            undefined,
          ],
          Array [
            "B",
            "J1",
            10,
            22,
          ],
          Array [
            "B",
            "J1",
            200,
            77,
          ],
        ],
      }
    `);
  });

  it('Error handling (no labels)', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2] },
          {
            name: 'Value',
            type: FieldType.number,
            values: [10, 200],
          },
        ],
      }),
    ];

    const result = joinByLabels(
      {
        value: 'what',
      },
      input
    );
    expect(result).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "name": "Error",
            "type": "string",
            "values": Array [
              "No labels in result",
            ],
          },
        ],
        "length": 0,
        "meta": Object {
          "notices": Array [
            Object {
              "severity": "error",
              "text": "No labels in result",
            },
          ],
        },
      }
    `);
  });
});

function toRowsSnapshow(frame: DataFrame) {
  const columns = frame.fields.map((f) => f.name);
  const rows = frame.fields[0].values.toArray().map((v, idx) => {
    return frame.fields.map((f) => f.values.get(idx));
  });
  return {
    columns,
    rows,
  };
}
