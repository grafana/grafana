import { toDataFrame, FieldType } from '@grafana/data';
import { getAnnotationsFromFrame } from './annotationsFromDataFrame';

describe('DataFrame to annotations', () => {
  test('check the executed queries', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'text', values: ['aaa', 'bbb', 'ccc'] },
        { type: FieldType.time, values: [1, 2, 3] },
      ],
    });

    const annos = getAnnotationsFromFrame(frame);
    expect(annos).toMatchInlineSnapshot(`
      Array [
        Object {
          "text": "aaa",
          "time": 1,
        },
        Object {
          "text": "bbb",
          "time": 2,
        },
        Object {
          "text": "ccc",
          "time": 3,
        },
      ]
    `);
  });
});
