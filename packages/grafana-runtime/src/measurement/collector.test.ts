import { FieldType } from '@grafana/data';
import { MeasurementCollector } from './collector';

describe('MeasurementCollector', () => {
  it('should collect values', () => {
    const collector = new MeasurementCollector();
    collector.addBatch({
      batch: [
        {
          key: 'aaa',
          schema: {
            fields: [
              { name: 'time', type: FieldType.time },
              { name: 'value', type: FieldType.number },
            ],
          },
          data: {
            values: [
              [100, 200],
              [1, 2],
            ],
          },
        },
        {
          key: 'aaa',
          data: { values: [[300], [3]] },
        },
        {
          key: 'aaa',
          data: { values: [[400], [4]] },
        },
      ],
    });

    const frames = collector.getData();
    expect(frames.length).toEqual(1);
    expect(frames[0]).toMatchInlineSnapshot(`
      StreamingDataFrame {
        "fields": Array [
          Object {
            "config": Object {},
            "labels": undefined,
            "name": "time",
            "type": "time",
            "values": Array [
              100,
              200,
              300,
              400,
            ],
          },
          Object {
            "config": Object {},
            "labels": undefined,
            "name": "value",
            "type": "number",
            "values": Array [
              1,
              2,
              3,
              4,
            ],
          },
        ],
        "length": 4,
        "meta": undefined,
        "name": undefined,
        "options": Object {
          "maxDelta": Infinity,
          "maxLength": 600,
        },
        "refId": undefined,
        "timeFieldIndex": 0,
      }
    `);
  });
});
