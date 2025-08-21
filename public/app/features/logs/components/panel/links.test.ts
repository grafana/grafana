import { FieldType } from "@grafana/data";

import { FieldDef } from "../logParser";

import { getTraceFromLinks } from "./links";

describe('getTraceFromLinks', () => {
  let fields: FieldDef[];
  beforeEach(() => {
    fields = [
      {
        keys: ['test'],
        values: ['not a trace'],
        fieldIndex: 0
      },
      {
        keys: ['traceID'],
        values: ['abcd1234'],
        fieldIndex: 1,
        links: [
          {
            href: "/explore?left=%7B%22range%22%3A%7B%22from%22%3A%22now-15m%22%2C%22to%22%3A%22now%22%7D%2C%22datasource%22%3A%22fetpfiwe8asqoe%22%2C%22queries%22%3A%5B%7B%22query%22%3A%22abcd1234%22%2C%22queryType%22%3A%22traceql%22%7D%5D%7D",
            title: "tempo",
            target: "_self",
            origin: {
              name: "traceID",
              type: FieldType.string,
              config: {},
              values: []
            }
          }
        ]
      }
    ]
  });

  test('Gets the trace information from a link', () => {
    expect(getTraceFromLinks(fields)).toEqual({
      dsUID: "fetpfiwe8asqoe",
      query: 'abcd1234',
      queryType: 'traceql',
    });
  });
});
