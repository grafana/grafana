import { toDataFrameDTO } from '@grafana/data';

import { toDataQueryResponse } from './queryResponse';

/* eslint-disable */
const resp = {
  data: {
    results: {
      GC: {
        dataframes: [
          'QVJST1cxAACsAQAAEAAAAAAACgAOAAwACwAEAAoAAAAUAAAAAAAAAQMACgAMAAAACAAEAAoAAAAIAAAAUAAAAAIAAAAoAAAABAAAAOD+//8IAAAADAAAAAIAAABHQwAABQAAAHJlZklkAAAAAP///wgAAAAMAAAAAAAAAAAAAAAEAAAAbmFtZQAAAAACAAAAlAAAAAQAAACG////FAAAAGAAAABgAAAAAAADAWAAAAACAAAALAAAAAQAAABQ////CAAAABAAAAAGAAAAbnVtYmVyAAAEAAAAdHlwZQAAAAB0////CAAAAAwAAAAAAAAAAAAAAAQAAABuYW1lAAAAAAAAAABm////AAACAAAAAAAAABIAGAAUABMAEgAMAAAACAAEABIAAAAUAAAAbAAAAHQAAAAAAAoBdAAAAAIAAAA0AAAABAAAANz///8IAAAAEAAAAAQAAAB0aW1lAAAAAAQAAAB0eXBlAAAAAAgADAAIAAQACAAAAAgAAAAQAAAABAAAAFRpbWUAAAAABAAAAG5hbWUAAAAAAAAAAAAABgAIAAYABgAAAAAAAwAEAAAAVGltZQAAAAC8AAAAFAAAAAAAAAAMABYAFAATAAwABAAMAAAA0AAAAAAAAAAUAAAAAAAAAwMACgAYAAwACAAEAAoAAAAUAAAAWAAAAA0AAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABoAAAAAAAAAGgAAAAAAAAAAAAAAAAAAABoAAAAAAAAAGgAAAAAAAAAAAAAAAIAAAANAAAAAAAAAAAAAAAAAAAADQAAAAAAAAAAAAAAAAAAAAAAAAAAFp00e2XHFQAIo158ZccVAPqoiH1lxxUA7K6yfmXHFQDetNx/ZccVANC6BoFlxxUAwsAwgmXHFQC0xlqDZccVAKbMhIRlxxUAmNKuhWXHFQCK2NiGZccVAHzeAohlxxUAbuQsiWXHFQAAAAAAAAhAAAAAAAAACEAAAAAAAAAIQAAAAAAAABRAAAAAAAAAFEAAAAAAAAAUQAAAAAAAAAhAAAAAAAAACEAAAAAAAAAIQAAAAAAAABRAAAAAAAAAFEAAAAAAAAAUQAAAAAAAAAhAEAAAAAwAFAASAAwACAAEAAwAAAAQAAAALAAAADgAAAAAAAMAAQAAALgBAAAAAAAAwAAAAAAAAADQAAAAAAAAAAAAAAAAAAAAAAAKAAwAAAAIAAQACgAAAAgAAABQAAAAAgAAACgAAAAEAAAA4P7//wgAAAAMAAAAAgAAAEdDAAAFAAAAcmVmSWQAAAAA////CAAAAAwAAAAAAAAAAAAAAAQAAABuYW1lAAAAAAIAAACUAAAABAAAAIb///8UAAAAYAAAAGAAAAAAAAMBYAAAAAIAAAAsAAAABAAAAFD///8IAAAAEAAAAAYAAABudW1iZXIAAAQAAAB0eXBlAAAAAHT///8IAAAADAAAAAAAAAAAAAAABAAAAG5hbWUAAAAAAAAAAGb///8AAAIAAAAAAAAAEgAYABQAEwASAAwAAAAIAAQAEgAAABQAAABsAAAAdAAAAAAACgF0AAAAAgAAADQAAAAEAAAA3P///wgAAAAQAAAABAAAAHRpbWUAAAAABAAAAHR5cGUAAAAACAAMAAgABAAIAAAACAAAABAAAAAEAAAAVGltZQAAAAAEAAAAbmFtZQAAAAAAAAAAAAAGAAgABgAGAAAAAAADAAQAAABUaW1lAAAAANgBAABBUlJPVzE=',
        ],
        frames: null as any,
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

describe('GEL Utils', () => {
  test('should parse output with dataframe', () => {
    const res = toDataQueryResponse(resp);
    const frames = res.data;
    for (const frame of frames) {
      expect(frame.refId).toEqual('GC');
    }

    const norm = frames.map(f => toDataFrameDTO(f));
    expect(norm).toMatchInlineSnapshot(`
      Array [
        Object {
          "fields": Array [
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "Time",
              "type": "time",
              "values": Array [
                1569334575000,
                1569334580000,
                1569334585000,
                1569334590000,
                1569334595000,
                1569334600000,
                1569334605000,
                1569334610000,
                1569334615000,
                1569334620000,
                1569334625000,
                1569334630000,
                1569334635000,
              ],
            },
            Object {
              "config": Object {},
              "labels": undefined,
              "name": "",
              "type": "number",
              "values": Array [
                3,
                3,
                3,
                5,
                5,
                5,
                3,
                3,
                3,
                5,
                5,
                5,
                3,
              ],
            },
          ],
          "meta": undefined,
          "name": undefined,
          "refId": "GC",
        },
      ]
    `);
  });

  test('processEmptyResults', () => {
    const frames = toDataQueryResponse(emptyResults).data;
    expect(frames.length).toEqual(0);
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

    const norm = res.data.map(f => toDataFrameDTO(f));
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
