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
            handlerKey: 'min',
          },
        ],
      },
      input
    );

    expect(result).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {
              "max": 15,
              "min": 3,
              "unit": "degree",
            },
            "name": "Temperature",
            "type": "number",
            "values": Array [
              10,
            ],
          },
          Object {
            "config": Object {
              "max": 200,
              "min": 100,
              "unit": "pressurebar",
            },
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

  it('Can handle colors', () => {
    const input = toDataFrame({
      fields: [
        { name: 'Name', type: FieldType.string, values: ['Temperature'] },
        { name: 'Value', type: FieldType.number, values: [10] },
        { name: 'Color', type: FieldType.string, values: ['blue'] },
      ],
    });

    const result = rowsToFields({}, input);

    expect(result.fields[0].config.color?.fixedColor).toBe('blue');
  });

  it('Can handle thresholds', () => {
    const input = toDataFrame({
      fields: [
        { name: 'Name', type: FieldType.string, values: ['Temperature'] },
        { name: 'Value', type: FieldType.number, values: [10] },
        { name: 'threshold1', type: FieldType.string, values: [30] },
        { name: 'threshold2', type: FieldType.string, values: [500] },
      ],
    });

    const result = rowsToFields({}, input);
    expect(result.fields[0].config.thresholds?.steps[1].value).toBe(30);
  });
});
