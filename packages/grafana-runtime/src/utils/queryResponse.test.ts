import { DataQuery, toDataFrameDTO, DataFrame } from '@grafana/data';
import { FetchError, FetchResponse } from 'src/services';
import { BackendDataSourceResponse, toDataQueryResponse, toTestingStatus } from './queryResponse';

const resp = ({
  data: {
    results: {
      A: {
        frames: [
          {
            schema: {
              refId: 'A',
              fields: [
                { name: 'time', type: 'time', typeInfo: { frame: 'time.Time', nullable: true } },
                { name: 'A-series', type: 'number', typeInfo: { frame: 'float64', nullable: true } },
              ],
            },
            data: {
              values: [
                [1611767228473, 1611767240473, 1611767252473, 1611767264473, 1611767276473, 1611767288473],
                [1, 20, 90, 30, 5, 0],
              ],
            },
          },
        ],
      },
      B: {
        frames: [
          {
            schema: {
              refId: 'B',
              fields: [
                { name: 'time', type: 'time', typeInfo: { frame: 'time.Time', nullable: true } },
                { name: 'B-series', type: 'number', typeInfo: { frame: 'float64', nullable: true } },
              ],
            },
            data: {
              values: [
                [1611767228473, 1611767240473, 1611767252473, 1611767264473, 1611767276473, 1611767288473],
                [1, 20, 90, 30, 5, 0],
              ],
            },
          },
        ],
      },
    },
  },
} as any) as FetchResponse<BackendDataSourceResponse>;

const resWithError = ({
  data: {
    results: {
      A: {
        error: 'Hello Error',
        frames: [
          {
            schema: {
              fields: [{ name: 'numbers', type: 'number' }],
              meta: {
                notices: [
                  {
                    severity: 2,
                    text: 'Text',
                  },
                ],
              },
            },
            data: {
              values: [[1, 3]],
            },
          },
        ],
      },
    },
  },
} as any) as FetchResponse<BackendDataSourceResponse>;

const emptyResults = {
  data: { results: { '': { refId: '' } } },
};

describe('Query Response parser', () => {
  test('should parse output with dataframe', () => {
    const res = toDataQueryResponse(resp);
    const frames = res.data;
    expect(frames).toHaveLength(2);
    expect(frames[0].refId).toEqual('A');
    expect(frames[1].refId).toEqual('B');

    const norm = frames.map((f) => toDataFrameDTO(f));
    expect(norm).toMatchInlineSnapshot(`
      Array [
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "time",
              "type": "time",
              "values": Array [
                1611767228473,
                1611767240473,
                1611767252473,
                1611767264473,
                1611767276473,
                1611767288473,
              ],
            },
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "A-series",
              "type": "number",
              "values": Array [
                1,
                20,
                90,
                30,
                5,
                0,
              ],
            },
          ],
          "meta": undefined,
          "name": undefined,
          "refId": "A",
        },
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "time",
              "type": "time",
              "values": Array [
                1611767228473,
                1611767240473,
                1611767252473,
                1611767264473,
                1611767276473,
                1611767288473,
              ],
            },
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "B-series",
              "type": "number",
              "values": Array [
                1,
                20,
                90,
                30,
                5,
                0,
              ],
            },
          ],
          "meta": undefined,
          "name": undefined,
          "refId": "B",
        },
      ]
    `);
  });

  test('should parse output with dataframe in order of queries', () => {
    const queries: DataQuery[] = [{ refId: 'B' }, { refId: 'A' }];
    const res = toDataQueryResponse(resp, queries);
    const frames = res.data;
    expect(frames).toHaveLength(2);
    expect(frames[0].refId).toEqual('B');
    expect(frames[1].refId).toEqual('A');

    const norm = frames.map((f) => toDataFrameDTO(f));
    expect(norm).toMatchInlineSnapshot(`
      Array [
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "time",
              "type": "time",
              "values": Array [
                1611767228473,
                1611767240473,
                1611767252473,
                1611767264473,
                1611767276473,
                1611767288473,
              ],
            },
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "B-series",
              "type": "number",
              "values": Array [
                1,
                20,
                90,
                30,
                5,
                0,
              ],
            },
          ],
          "meta": undefined,
          "name": undefined,
          "refId": "B",
        },
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "time",
              "type": "time",
              "values": Array [
                1611767228473,
                1611767240473,
                1611767252473,
                1611767264473,
                1611767276473,
                1611767288473,
              ],
            },
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "A-series",
              "type": "number",
              "values": Array [
                1,
                20,
                90,
                30,
                5,
                0,
              ],
            },
          ],
          "meta": undefined,
          "name": undefined,
          "refId": "A",
        },
      ]
    `);
  });

  test('processEmptyResults', () => {
    const frames = toDataQueryResponse(emptyResults).data;
    expect(frames.length).toEqual(0);
  });

  test('keeps query order', () => {
    const resp = {
      data: {
        results: {
          X: {
            series: [{ name: 'Requests/s', points: [[13.594958983547151, 1611839862951]] }] as any,
          },
          B: {
            series: [{ name: 'Requests/s', points: [[13.594958983547151, 1611839862951]] }] as any,
          },
          A: {
            series: [{ name: 'Requests/s', points: [[13.594958983547151, 1611839862951]] }] as any,
          },
        },
      },
    };

    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B' }];

    const ids = (toDataQueryResponse(resp, queries).data as DataFrame[]).map((f) => f.refId);
    expect(ids).toEqual(['A', 'B']);
  });

  test('resultWithError', () => {
    // Generated from:
    // qdr.Responses[q.GetRefID()] = backend.DataResponse{
    //   Error: fmt.Errorf("an Error: %w", fmt.Errorf("another error")),
    //   Frames: data.Frames{
    //     {
    //       Fields: data.Fields{data.NewField("numbers", nil, []float64{1, 3})},
    //       Meta: &data.FrameMeta{
    //         Notices: []data.Notice{
    //           {
    //             Severity: data.NoticeSeverityError,
    //             Text:     "Text",
    //           },
    //         },
    //       },
    //     },
    //   },
    // }
    const res = toDataQueryResponse(resWithError);
    expect(res.error).toMatchInlineSnapshot(`
      Object {
        "message": "Hello Error",
        "refId": "A",
      }
    `);

    const norm = res.data.map((f) => toDataFrameDTO(f));
    expect(norm).toMatchInlineSnapshot(`
      Array [
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "numbers",
              "type": "number",
              "values": Array [
                1,
                3,
              ],
            },
          ],
          "meta": Object {
            "notices": Array [
              Object {
                "severity": 2,
                "text": "Text",
              },
            ],
          },
          "name": undefined,
          "refId": "A",
        },
      ]
    `);
  });

  describe('should convert to TestingStatus', () => {
    test('from api/ds/query generic errors', () => {
      const result = toTestingStatus({ status: 500, data: { message: 'message', error: 'error' } } as FetchError);
      expect(result).toMatchObject({
        status: 'error',
        message: 'message',
        details: { message: 'error' },
      });
    });
    test('from api/ds/query result errors', () => {
      const result = toTestingStatus({
        status: 400,
        data: {
          results: {
            A: {
              error: 'error',
            },
          },
        },
      } as FetchError);
      expect(result).toMatchObject({
        status: 'error',
        message: 'error',
      });
    });
    test('unknown errors', () => {
      expect(() => {
        toTestingStatus({ status: 503, data: 'Fatal Error' } as FetchError);
      }).toThrow();

      expect(() => {
        toTestingStatus({ status: 503, data: {} } as FetchError);
      }).toThrow();

      expect(() => {
        toTestingStatus({ status: 503 } as FetchError);
      }).toThrow();
    });
  });
});
