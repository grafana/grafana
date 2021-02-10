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
          data: [
            [100, 200],
            [1, 2],
          ],
        },
        {
          key: 'aaa',
          data: [[300], [3]],
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
            "name": "time",
            "replaced": Object {},
            "type": "time",
            "values": Array [
              100,
              200,
              300,
            ],
          },
          Object {
            "config": Object {},
            "name": "value",
            "replaced": Object {},
            "type": "number",
            "values": Array [
              1,
              2,
              3,
            ],
          },
        ],
        "lastUpdateTime": 1612915480600,
        "meta": undefined,
        "name": undefined,
        "options": Object {
          "maxLength": 600,
        },
        "refId": undefined,
        "timeFieldIndex": 0,
      }
    `);
  });
});
