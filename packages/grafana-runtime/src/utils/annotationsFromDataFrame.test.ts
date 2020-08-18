import { toDataFrame, FieldType } from '@grafana/data';
import { getAnnotationsFromFrame } from './annotationsFromDataFrame';

describe('DataFrame to annotations', () => {
  test('simple conversion', () => {
    const frame = toDataFrame({
      fields: [
        { type: FieldType.time, values: [1, 2, 3] },
        { name: 'first string field', values: ['t1', 't2', 't3'] },
        { name: 'tags', values: ['aaa,bbb', 'bbb,ccc', 'zyz'] },
      ],
    });

    const annos = getAnnotationsFromFrame(frame);
    expect(annos).toMatchInlineSnapshot(`
      Array [
        Object {
          "tags": Array [
            "aaa",
            "bbb",
          ],
          "text": "t1",
          "time": 1,
        },
        Object {
          "tags": Array [
            "bbb",
            "ccc",
          ],
          "text": "t2",
          "time": 2,
        },
        Object {
          "tags": Array [
            "zyz",
          ],
          "text": "t3",
          "time": 3,
        },
      ]
    `);
  });

  test('explicit mappins', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time1', values: [100, 200, 300] },
        { name: 'time2', values: [111, 222, 333] },
        { name: 'aaaaa', values: ['a1', 'a2', 'a3'] },
        { name: 'bbbbb', values: ['b1', 'b2', 'b3'] },
      ],
    });

    const annos = getAnnotationsFromFrame(frame, {
      field: {
        text: 'bbbbb',
        time: 'time2',
        timeEnd: 'time1',
        title: 'aaaaa',
      },
    });
    expect(annos).toMatchInlineSnapshot(`
      Array [
        Object {
          "text": "b1",
          "time": 111,
          "timeEnd": 100,
          "title": "a1",
        },
        Object {
          "text": "b2",
          "time": 222,
          "timeEnd": 200,
          "title": "a2",
        },
        Object {
          "text": "b3",
          "time": 333,
          "timeEnd": 300,
          "title": "a3",
        },
      ]
    `);
  });
});
