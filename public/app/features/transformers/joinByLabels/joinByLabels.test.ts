import { toDataFrame, FieldType, DataFrame } from '@grafana/data';

import { joinByLabels } from './joinByLabels';

describe('Join by labels', () => {
  const input = [
    toDataFrame({
      refId: 'A',
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
      refId: 'B',
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
      refId: 'C',
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

  it('Simple join with dynamic refId', () => {
    const result = joinByLabels(
      {
        value: 'what',
      },
      input
    );
    expect(result.refId).toBe('joinByLabels-A-B-C');
    expect(result.fields[result.fields.length - 1].config).toMatchInlineSnapshot(`{}`);
    expect(toRowsSnapshow(result)).toMatchInlineSnapshot(`
      {
        "columns": [
          "cluster",
          "job",
          "Temp",
          "Speed",
        ],
        "rows": [
          [
            "A",
            "J1",
            10,
            undefined,
          ],
          [
            "A",
            "J1",
            200,
            undefined,
          ],
          [
            "B",
            "J1",
            10,
            22,
          ],
          [
            "B",
            "J1",
            200,
            77,
          ],
        ],
      }
    `);
  });

  it('Simple join with static refId', () => {
    const result = joinByLabels(
      {
        value: 'what',
        refId: 'test',
      },
      input
    );
    expect(result.refId).toBe('test');
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
      {
        "fields": [
          {
            "config": {},
            "name": "Error",
            "type": "string",
            "values": [
              "No labels in result",
            ],
          },
        ],
        "length": 0,
        "meta": {
          "notices": [
            {
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
  const rows = frame.fields[0].values.map((v, idx) => {
    return frame.fields.map((f) => f.values[idx]);
  });
  return {
    columns,
    rows,
  };
}
