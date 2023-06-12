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
      {
        "fields": [
          {
            "config": {
              "max": 15,
              "min": 3,
              "unit": "degree",
            },
            "labels": {},
            "name": "Temperature",
            "type": "number",
            "values": [
              10,
            ],
          },
          {
            "config": {
              "max": 200,
              "min": 100,
              "unit": "pressurebar",
            },
            "labels": {},
            "name": "Pressure",
            "type": "number",
            "values": [
              200,
            ],
          },
        ],
        "length": 1,
      }
    `);
  });

  it('Can handle custom name and value field mapping', () => {
    const input = toDataFrame({
      fields: [
        { name: 'Name', type: FieldType.string, values: ['Ignore'] },
        { name: 'SensorName', type: FieldType.string, values: ['Temperature'] },
        { name: 'Value', type: FieldType.number, values: [10] },
        { name: 'SensorReading', type: FieldType.number, values: [100] },
      ],
    });

    const result = rowsToFields(
      {
        mappings: [
          { fieldName: 'SensorName', handlerKey: 'field.name' },
          { fieldName: 'SensorReading', handlerKey: 'field.value' },
        ],
      },
      input
    );

    expect(result.fields[0].name).toBe('Temperature');
    expect(result.fields[0].config).toEqual({});
    expect(result.fields[0].values[0]).toBe(100);
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

  it('Will extract other string fields to labels', () => {
    const input = toDataFrame({
      fields: [
        { name: 'Name', type: FieldType.string, values: ['Temperature', 'Pressure'] },
        { name: 'Value', type: FieldType.number, values: [10, 200] },
        { name: 'City', type: FieldType.string, values: ['Stockholm', 'New York'] },
      ],
    });

    const result = rowsToFields({}, input);

    expect(result.fields[0].labels).toEqual({ City: 'Stockholm' });
    expect(result.fields[1].labels).toEqual({ City: 'New York' });
  });

  it('Can ignore field as auto picked for value or name', () => {
    const input = toDataFrame({
      fields: [
        { name: 'Name', type: FieldType.string, values: ['Temperature'] },
        { name: 'Value', type: FieldType.number, values: [10] },
        { name: 'City', type: FieldType.string, values: ['Stockholm'] },
        { name: 'Value2', type: FieldType.number, values: [20] },
      ],
    });

    const result = rowsToFields(
      {
        mappings: [
          { fieldName: 'Name', handlerKey: '__ignore' },
          { fieldName: 'Value', handlerKey: '__ignore' },
        ],
      },
      input
    );

    expect(result.fields[0].name).toEqual('Stockholm');
    expect(result.fields[0].values[0]).toEqual(20);
  });

  it('Can handle number fields as name field', () => {
    const input = toDataFrame({
      fields: [
        { name: 'SensorID', type: FieldType.number, values: [10, 20, 30] },
        { name: 'Value', type: FieldType.number, values: [1, 2, 3] },
      ],
    });

    const result = rowsToFields(
      {
        mappings: [
          { fieldName: 'SensorID', handlerKey: 'field.name' },
          { fieldName: 'Value', handlerKey: 'field.value' },
        ],
      },
      input
    );

    expect(result.fields[0].name).toEqual('10');
    expect(result.fields[0].values[0]).toEqual(1);
  });
});
