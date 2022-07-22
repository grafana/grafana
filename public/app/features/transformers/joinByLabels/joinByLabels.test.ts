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
            values: [10, 200],
            labels: { what: 'Price', cluster: 'A', job: 'J1' },
          },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2] },
          {
            name: 'Value',
            type: FieldType.number,
            values: [10, 200],
            labels: { what: 'Price', cluster: 'B', job: 'J1' },
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
    expect(toRowsSnapshow(result)).toMatchInlineSnapshot(`
      Object {
        "columns": Array [
          "cluster",
          "job",
          "Price",
        ],
        "rows": Array [
          Array [
            "A",
            "J1",
            10,
          ],
          Array [
            "A",
            "J1",
            200,
          ],
          Array [
            "B",
            "J1",
            10,
          ],
          Array [
            "B",
            "J1",
            200,
          ],
        ],
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
