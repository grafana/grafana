import { FetchError, FetchResponse } from 'src/services';

import { DataQuery, toDataFrameDTO, DataFrame } from '@grafana/data';

import { BackendDataSourceResponse, cachedResponseNotice, toDataQueryResponse, toTestingStatus } from './queryResponse';

const resp = {
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
} as unknown as FetchResponse<BackendDataSourceResponse>;

const resWithError = {
  data: {
    results: {
      A: {
        error: 'Hello Error',
        status: 400,
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
} as unknown as FetchResponse<BackendDataSourceResponse>;

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
      [
        {
          "fields": [
            {
              "config": {},
              "labels": undefined,
              "name": "time",
              "type": "time",
              "values": [
                1611767228473,
                1611767240473,
                1611767252473,
                1611767264473,
                1611767276473,
                1611767288473,
              ],
            },
            {
              "config": {},
              "labels": undefined,
              "name": "A-series",
              "type": "number",
              "values": [
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
        {
          "fields": [
            {
              "config": {},
              "labels": undefined,
              "name": "time",
              "type": "time",
              "values": [
                1611767228473,
                1611767240473,
                1611767252473,
                1611767264473,
                1611767276473,
                1611767288473,
              ],
            },
            {
              "config": {},
              "labels": undefined,
              "name": "B-series",
              "type": "number",
              "values": [
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
      [
        {
          "fields": [
            {
              "config": {},
              "labels": undefined,
              "name": "time",
              "type": "time",
              "values": [
                1611767228473,
                1611767240473,
                1611767252473,
                1611767264473,
                1611767276473,
                1611767288473,
              ],
            },
            {
              "config": {},
              "labels": undefined,
              "name": "B-series",
              "type": "number",
              "values": [
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
        {
          "fields": [
            {
              "config": {},
              "labels": undefined,
              "name": "time",
              "type": "time",
              "values": [
                1611767228473,
                1611767240473,
                1611767252473,
                1611767264473,
                1611767276473,
                1611767288473,
              ],
            },
            {
              "config": {},
              "labels": undefined,
              "name": "A-series",
              "type": "number",
              "values": [
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
            series: [{ target: '', datapoints: [[13.594958983547151, 1611839862951]] }],
          },
          B: {
            series: [{ target: '', datapoints: [[13.594958983547151, 1611839862951]] }],
          },
          A: {
            series: [{ target: '', datapoints: [[13.594958983547151, 1611839862951]] }],
          },
        },
      },
    };

    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B' }];

    const ids = (toDataQueryResponse(resp, queries).data as DataFrame[]).map((f) => f.refId);
    expect(ids).toEqual(['A', 'B']);
  });

  test('should handle a success-response without traceIds', () => {
    const input = {
      data: {
        results: {
          A: {
            frames: [],
          },
        },
      },
    } as unknown as FetchResponse<BackendDataSourceResponse>;
    const res = toDataQueryResponse(input);
    expect(res.traceIds).toBeUndefined();
  });

  test('should handle a success-response with traceIds', () => {
    const input = {
      data: {
        results: {
          A: {
            frames: [],
          },
        },
      },
      traceId: 'traceId1',
    } as unknown as FetchResponse<BackendDataSourceResponse>;
    const res = toDataQueryResponse(input);
    expect(res.traceIds).toStrictEqual(['traceId1']);
  });

  test('should handle an error-response without traceIds', () => {
    const input = {
      data: {
        results: {
          A: {
            error: 'error from A',
            status: 400,
          },
          B: {
            error: 'error from B',
            status: 400,
          },
        },
      },
    } as unknown as FetchResponse<BackendDataSourceResponse>;
    const res = toDataQueryResponse(input);
    expect(res.traceIds).toBeUndefined();
    expect(res.error?.traceId).toBeUndefined();
    expect(res.errors).toHaveLength(2);
    expect(res.errors?.[0].traceId).toBeUndefined();
    expect(res.errors?.[1].traceId).toBeUndefined();
  });

  test('should handle an error-response with traceIds', () => {
    const input = {
      data: {
        results: {
          A: {
            error: 'error from A',
            status: 400,
          },
          B: {
            error: 'error from B',
            status: 400,
          },
        },
      },
      traceId: 'traceId1',
    } as unknown as FetchResponse<BackendDataSourceResponse>;
    const res = toDataQueryResponse(input);
    expect(res.traceIds).toStrictEqual(['traceId1']);
    expect(res.error?.traceId).toBe('traceId1');
    expect(res.errors).toHaveLength(2);
    expect(res.errors?.[0].traceId).toBe('traceId1');
    expect(res.errors?.[1].traceId).toBe('traceId1');
  });

  describe('Cache notice', () => {
    let resp: FetchResponse<BackendDataSourceResponse>;

    beforeEach(() => {
      resp = {
        url: '',
        type: 'basic',
        config: { url: '' },
        status: 200,
        statusText: 'OK',
        ok: true,
        redirected: false,
        headers: new Headers(),
        data: {
          results: {
            A: { frames: [{ schema: { fields: [] } }] },
          },
        },
      };
    });

    test('adds notice and cached boolean for responses with X-Cache: HIT header', () => {
      const queries: DataQuery[] = [{ refId: 'A' }];
      resp.headers.set('X-Cache', 'HIT');
      const meta = toDataQueryResponse(resp, queries).data[0].meta;
      expect(meta.notices).toStrictEqual([cachedResponseNotice]);
      expect(meta.isCachedResponse).toBeTruthy();
    });

    test('does not remove existing notices', () => {
      const queries: DataQuery[] = [{ refId: 'A' }];
      resp.headers.set('X-Cache', 'HIT');
      resp.data.results.A.frames![0].schema!.meta = { notices: [{ severity: 'info', text: 'Example' }] };
      expect(toDataQueryResponse(resp, queries).data[0].meta.notices).toStrictEqual([
        { severity: 'info', text: 'Example' },
        cachedResponseNotice,
      ]);
    });

    test('does not add notice or cached response boolean for responses with X-Cache: MISS header', () => {
      const queries: DataQuery[] = [{ refId: 'A' }];
      resp.headers.set('X-Cache', 'MISS');
      expect(toDataQueryResponse(resp, queries).data[0].meta?.notices).toBeUndefined();
      expect(toDataQueryResponse(resp, queries).data[0].meta?.isCachedResponse).toBeUndefined();
    });

    test('does not add notice for responses without X-Cache header', () => {
      const queries: DataQuery[] = [{ refId: 'A' }];
      expect(toDataQueryResponse(resp, queries).data[0].meta?.notices).toBeUndefined();
    });
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
      {
        "message": "Hello Error",
        "refId": "A",
        "status": 400,
      }
    `);
    expect(res.errors).toEqual([
      {
        message: 'Hello Error',
        refId: 'A',
        status: 400,
      },
    ]);

    const norm = res.data.map((f) => toDataFrameDTO(f));
    expect(norm).toMatchInlineSnapshot(`
      [
        {
          "fields": [
            {
              "config": {},
              "labels": undefined,
              "name": "numbers",
              "type": "number",
              "values": [
                1,
                3,
              ],
            },
          ],
          "meta": {
            "notices": [
              {
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
