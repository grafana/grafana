import { DataQuery, toDataFrameDTO, DataFrame } from '@grafana/data';
import { toDataQueryResponse } from './queryResponse';

/* eslint-disable */
const resp = {
  data: {
    results: {
      A: {
        refId: 'A',
        series: null,
        tables: null,
        dataframes: [
          'QVJST1cxAAD/////cAEAABAAAAAAAAoADgAMAAsABAAKAAAAFAAAAAAAAAEDAAoADAAAAAgABAAKAAAACAAAAFAAAAACAAAAKAAAAAQAAAAg////CAAAAAwAAAABAAAAQQAAAAUAAAByZWZJZAAAAED///8IAAAADAAAAAAAAAAAAAAABAAAAG5hbWUAAAAAAgAAAHwAAAAEAAAAnv///xQAAABAAAAAQAAAAAAAAwFAAAAAAQAAAAQAAACM////CAAAABQAAAAIAAAAQS1zZXJpZXMAAAAABAAAAG5hbWUAAAAAAAAAAIb///8AAAIACAAAAEEtc2VyaWVzAAASABgAFAATABIADAAAAAgABAASAAAAFAAAAEQAAABMAAAAAAAKAUwAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAQAAAABAAAAHRpbWUAAAAABAAAAG5hbWUAAAAAAAAAAAAABgAIAAYABgAAAAAAAwAEAAAAdGltZQAAAAAAAAAA/////7gAAAAUAAAAAAAAAAwAFgAUABMADAAEAAwAAABgAAAAAAAAABQAAAAAAAADAwAKABgADAAIAAQACgAAABQAAABYAAAABgAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAMAAAAAAAAAAAAAAAAgAAAAYAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAQMC/OcElXhZAOAEFxCVeFkCwQtDGJV4WQCiEm8klXhZAoMVmzCVeFkAYBzLPJV4WAAAAAAAA8D8AAAAAAAA0QAAAAAAAgFZAAAAAAAAAPkAAAAAAAAAUQAAAAAAAAAAAEAAAAAwAFAASAAwACAAEAAwAAAAQAAAALAAAADgAAAAAAAMAAQAAAIABAAAAAAAAwAAAAAAAAABgAAAAAAAAAAAAAAAAAAAAAAAKAAwAAAAIAAQACgAAAAgAAABQAAAAAgAAACgAAAAEAAAAIP///wgAAAAMAAAAAQAAAEEAAAAFAAAAcmVmSWQAAABA////CAAAAAwAAAAAAAAAAAAAAAQAAABuYW1lAAAAAAIAAAB8AAAABAAAAJ7///8UAAAAQAAAAEAAAAAAAAMBQAAAAAEAAAAEAAAAjP///wgAAAAUAAAACAAAAEEtc2VyaWVzAAAAAAQAAABuYW1lAAAAAAAAAACG////AAACAAgAAABBLXNlcmllcwAAEgAYABQAEwASAAwAAAAIAAQAEgAAABQAAABEAAAATAAAAAAACgFMAAAAAQAAAAwAAAAIAAwACAAEAAgAAAAIAAAAEAAAAAQAAAB0aW1lAAAAAAQAAABuYW1lAAAAAAAAAAAAAAYACAAGAAYAAAAAAAMABAAAAHRpbWUAAAAAmAEAAEFSUk9XMQ==',
        ],
      },
      B: {
        refId: 'B',
        series: null,
        tables: null,
        dataframes: [
          'QVJST1cxAAD/////cAEAABAAAAAAAAoADgAMAAsABAAKAAAAFAAAAAAAAAEDAAoADAAAAAgABAAKAAAACAAAAFAAAAACAAAAKAAAAAQAAAAg////CAAAAAwAAAABAAAAQgAAAAUAAAByZWZJZAAAAED///8IAAAADAAAAAAAAAAAAAAABAAAAG5hbWUAAAAAAgAAAHwAAAAEAAAAnv///xQAAABAAAAAQAAAAAAAAwFAAAAAAQAAAAQAAACM////CAAAABQAAAAIAAAAQi1zZXJpZXMAAAAABAAAAG5hbWUAAAAAAAAAAIb///8AAAIACAAAAEItc2VyaWVzAAASABgAFAATABIADAAAAAgABAASAAAAFAAAAEQAAABMAAAAAAAKAUwAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAQAAAABAAAAHRpbWUAAAAABAAAAG5hbWUAAAAAAAAAAAAABgAIAAYABgAAAAAAAwAEAAAAdGltZQAAAAAAAAAA/////7gAAAAUAAAAAAAAAAwAFgAUABMADAAEAAwAAABgAAAAAAAAABQAAAAAAAADAwAKABgADAAIAAQACgAAABQAAABYAAAABgAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAMAAAAAAAAAAAAAAAAgAAAAYAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAQMC/OcElXhZAOAEFxCVeFkCwQtDGJV4WQCiEm8klXhZAoMVmzCVeFkAYBzLPJV4WAAAAAAAA8D8AAAAAAAA0QAAAAAAAgFZAAAAAAAAAPkAAAAAAAAAUQAAAAAAAAAAAEAAAAAwAFAASAAwACAAEAAwAAAAQAAAALAAAADgAAAAAAAMAAQAAAIABAAAAAAAAwAAAAAAAAABgAAAAAAAAAAAAAAAAAAAAAAAKAAwAAAAIAAQACgAAAAgAAABQAAAAAgAAACgAAAAEAAAAIP///wgAAAAMAAAAAQAAAEIAAAAFAAAAcmVmSWQAAABA////CAAAAAwAAAAAAAAAAAAAAAQAAABuYW1lAAAAAAIAAAB8AAAABAAAAJ7///8UAAAAQAAAAEAAAAAAAAMBQAAAAAEAAAAEAAAAjP///wgAAAAUAAAACAAAAEItc2VyaWVzAAAAAAQAAABuYW1lAAAAAAAAAACG////AAACAAgAAABCLXNlcmllcwAAEgAYABQAEwASAAwAAAAIAAQAEgAAABQAAABEAAAATAAAAAAACgFMAAAAAQAAAAwAAAAIAAwACAAEAAgAAAAIAAAAEAAAAAQAAAB0aW1lAAAAAAQAAABuYW1lAAAAAAAAAAAAAAYACAAGAAYAAAAAAAMABAAAAHRpbWUAAAAAmAEAAEFSUk9XMQ==',
        ],
      },
    },
  },
};

const resWithError = {
  data: {
    results: {
      A: {
        error: 'Hello Error',
        series: null,
        tables: null,
        dataframes: [
          'QVJST1cxAAD/////WAEAABAAAAAAAAoADgAMAAsABAAKAAAAFAAAAAAAAAEDAAoADAAAAAgABAAKAAAACAAAAJwAAAADAAAATAAAACgAAAAEAAAAPP///wgAAAAMAAAAAAAAAAAAAAAFAAAAcmVmSWQAAABc////CAAAAAwAAAAAAAAAAAAAAAQAAABuYW1lAAAAAHz///8IAAAANAAAACoAAAB7Im5vdGljZXMiOlt7InNldmVyaXR5IjoyLCJ0ZXh0IjoiVGV4dCJ9XX0AAAQAAABtZXRhAAAAAAEAAAAYAAAAAAASABgAFAAAABMADAAAAAgABAASAAAAFAAAAEQAAABMAAAAAAAAA0wAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAQAAAABwAAAG51bWJlcnMABAAAAG5hbWUAAAAAAAAAAAAABgAIAAYABgAAAAAAAgAHAAAAbnVtYmVycwAAAAAA/////4gAAAAUAAAAAAAAAAwAFgAUABMADAAEAAwAAAAQAAAAAAAAABQAAAAAAAADAwAKABgADAAIAAQACgAAABQAAAA4AAAAAgAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAEAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAA8D8AAAAAAAAIQBAAAAAMABQAEgAMAAgABAAMAAAAEAAAACwAAAA4AAAAAAADAAEAAABoAQAAAAAAAJAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAACgAMAAAACAAEAAoAAAAIAAAAnAAAAAMAAABMAAAAKAAAAAQAAAA8////CAAAAAwAAAAAAAAAAAAAAAUAAAByZWZJZAAAAFz///8IAAAADAAAAAAAAAAAAAAABAAAAG5hbWUAAAAAfP///wgAAAA0AAAAKgAAAHsibm90aWNlcyI6W3sic2V2ZXJpdHkiOjIsInRleHQiOiJUZXh0In1dfQAABAAAAG1ldGEAAAAAAQAAABgAAAAAABIAGAAUAAAAEwAMAAAACAAEABIAAAAUAAAARAAAAEwAAAAAAAADTAAAAAEAAAAMAAAACAAMAAgABAAIAAAACAAAABAAAAAHAAAAbnVtYmVycwAEAAAAbmFtZQAAAAAAAAAAAAAGAAgABgAGAAAAAAACAAcAAABudW1iZXJzAIABAABBUlJPVzE=',
        ],
      },
    },
  },
};

const emptyResults = {
  data: { '': { refId: '', meta: null, series: null, tables: null, dataframes: null } },
};

/* eslint-enable */

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
            series: [
              { name: 'Requests/s', points: [[13.594958983547151, 1611839862951]], tables: null, dataframes: null },
            ],
          },
          B: {
            series: [
              { name: 'Requests/s', points: [[13.594958983547151, 1611839862951]], tables: null, dataframes: null },
            ],
          },
          A: {
            series: [
              { name: 'Requests/s', points: [[13.594958983547151, 1611839862951]], tables: null, dataframes: null },
            ],
          },
        },
      },
    };

    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B' }];

    const ids = (toDataQueryResponse(resp, queries).data as DataFrame[]).map((f) => f.refId);
    expect(ids).toEqual(['A', 'B', 'X']);
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
});
