import { MeasurementCollector } from './collector';
import { MeasurementAction } from './types';

describe('MeasurementCollector', () => {
  it('should collect values', () => {
    const collector = new MeasurementCollector();
    collector.addBatch({
      measurements: [
        {
          name: 'test',
          labels: { host: 'a' },
          time: 100,
          values: {
            f0: 0,
            f1: 1,
            f2: 'hello',
          },
        },
        {
          name: 'test',
          labels: { host: 'b' },
          time: 101,
          values: {
            f0: 0,
            f1: 1,
            f2: 'hello',
          },
          config: {
            f2: {
              unit: 'mph',
            },
          },
        },
        {
          name: 'test',
          time: 102,
          labels: { host: 'a' }, // should append to first value
          values: {
            // note the missing values for f0/1
            f2: 'world',
          },
        },
      ],
    });

    const frames = collector.getData();
    expect(frames.length).toEqual(2);
    expect(frames[0]).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "labels": undefined,
            "name": "time",
            "type": "time",
            "values": Array [
              100,
              102,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {
              "host": "a",
            },
            "name": "f0",
            "type": "number",
            "values": Array [
              0,
              null,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {
              "host": "a",
            },
            "name": "f1",
            "type": "number",
            "values": Array [
              1,
              null,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {
              "host": "a",
            },
            "name": "f2",
            "type": "string",
            "values": Array [
              "hello",
              "world",
            ],
          },
        ],
        "meta": Object {
          "custom": Object {
            "labels": Object {
              "host": "a",
            },
          },
        },
        "name": "test",
        "refId": undefined,
      }
    `);
    expect(frames[1]).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "labels": undefined,
            "name": "time",
            "type": "time",
            "values": Array [
              101,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {
              "host": "b",
            },
            "name": "f0",
            "type": "number",
            "values": Array [
              0,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {
              "host": "b",
            },
            "name": "f1",
            "type": "number",
            "values": Array [
              1,
            ],
          },
          Object {
            "config": Object {
              "unit": "mph",
            },
            "labels": Object {
              "host": "b",
            },
            "name": "f2",
            "type": "string",
            "values": Array [
              "hello",
            ],
          },
        ],
        "meta": Object {
          "custom": Object {
            "labels": Object {
              "host": "b",
            },
          },
        },
        "name": "test",
        "refId": undefined,
      }
    `);

    collector.addBatch({
      action: MeasurementAction.Replace,
      measurements: [
        {
          name: 'test',
          time: 105,
          labels: { host: 'a' },
          values: {
            f1: 10,
          },
        },
      ],
    });

    const frames2 = collector.getData();
    expect(frames2.length).toEqual(2);
    expect(frames2[0].length).toEqual(1); // not three!
    expect(frames2[0]).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "labels": undefined,
            "name": "time",
            "type": "time",
            "values": Array [
              105,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {
              "host": "a",
            },
            "name": "f0",
            "type": "number",
            "values": Array [
              null,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {
              "host": "a",
            },
            "name": "f1",
            "type": "number",
            "values": Array [
              10,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {
              "host": "a",
            },
            "name": "f2",
            "type": "string",
            "values": Array [
              null,
            ],
          },
        ],
        "meta": Object {
          "custom": Object {
            "labels": Object {
              "host": "a",
            },
          },
        },
        "name": "test",
        "refId": undefined,
      }
    `);

    collector.addBatch({
      action: MeasurementAction.Clear,
      measurements: [],
    });
    expect(collector.getData().length).toEqual(0);
  });
});
