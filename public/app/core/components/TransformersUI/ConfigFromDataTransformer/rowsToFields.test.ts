import { toDataFrame, FieldType } from '@grafana/data';
import { rowsToFields } from './rowsToFields';

describe('Rows to fields', () => {
  it('Will extract min & max from field', () => {
    const input = toDataFrame({
      fields: [
        { name: 'Name', type: FieldType.string, values: ['Temperature', 'Pressure'] },
        { name: 'Value', type: FieldType.number, values: [10, 200] },
        { name: 'Unit', type: FieldType.string, values: ['degree', 'pressurebar'] },
        { name: 'Miiin', type: FieldType.number, values: [3, 100] },
        { name: 'max', type: FieldType.string, values: [15, 200] },
      ],
    });

    const result = rowsToFields(
      {
        nameField: 'Name',
        valueField: 'Value',
        mappings: [
          {
            fieldName: 'Miiin',
            configProperty: 'min',
          },
        ],
      },
      input
    );

    expect(result).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "name": "Temperature",
            "type": "number",
            "values": Array [
              10,
            ],
          },
          Object {
            "config": Object {},
            "name": "Pressure",
            "type": "number",
            "values": Array [
              200,
            ],
          },
        ],
        "length": 1,
      }
    `);
  });
});
