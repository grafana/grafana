import { defaultSettings } from './datasource.test';
import {
  createTableFrameFromMetricsSummaryQuery,
  emptyResponse,
  getConfigQuery,
  transformToMetricsData,
} from './metricsSummary';

describe('MetricsSummary', () => {
  describe('createTableFrameFromMetricsSummaryQuery', () => {
    it('should return emptyResponse when state is LoadingState.Error', () => {
      const result = createTableFrameFromMetricsSummaryQuery([], '', defaultSettings);
      expect(result).toEqual(emptyResponse);
    });

    it('should return correctly when state is LoadingState.Done', () => {
      const data = [
        {
          spanCount: '10',
          errorSpanCount: '1',
          p50: '1',
          p90: '2',
          p95: '3',
          p99: '4',
          series: [
            {
              key: 'span.http.status_code',
              value: {
                type: 3,
                n: 208,
              },
            },
            {
              key: 'temperature',
              value: {
                type: 4,
                f: 38.1,
              },
            },
          ],
        },
      ];
      const result = createTableFrameFromMetricsSummaryQuery(
        data,
        '{name="HTTP POST - post"} | by(resource.service.name)',
        defaultSettings
      );
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "fields": [
              {
                "config": {
                  "displayNameFromDS": "span.http.status_code",
                  "links": [
                    {
                      "internal": {
                        "datasourceName": "tempo",
                        "datasourceUid": "gdev-tempo",
                        "query": {
                          "query": "{name="HTTP POST - post" && span.http.status_code=\${__data.fields["span.http.status_code"]} && temperature=\${__data.fields["temperature"]} && kind=server} | by(resource.service.name)",
                          "queryType": "traceql",
                        },
                      },
                      "title": "Query in explore",
                      "url": "",
                    },
                  ],
                },
                "name": "span.http.status_code",
                "type": "string",
                "values": [
                  208,
                ],
              },
              {
                "config": {
                  "displayNameFromDS": "temperature",
                  "links": [
                    {
                      "internal": {
                        "datasourceName": "tempo",
                        "datasourceUid": "gdev-tempo",
                        "query": {
                          "query": "{name="HTTP POST - post" && span.http.status_code=\${__data.fields["span.http.status_code"]} && temperature=\${__data.fields["temperature"]} && kind=server} | by(resource.service.name)",
                          "queryType": "traceql",
                        },
                      },
                      "title": "Query in explore",
                      "url": "",
                    },
                  ],
                },
                "name": "temperature",
                "type": "string",
                "values": [
                  38.1,
                ],
              },
              {
                "config": {
                  "custom": {
                    "width": 150,
                  },
                  "displayNameFromDS": "Kind",
                },
                "name": "kind",
                "type": "string",
                "values": [
                  "server",
                ],
              },
              {
                "config": {
                  "custom": {
                    "width": 150,
                  },
                  "displayNameFromDS": "Span count",
                },
                "name": "spanCount",
                "type": "string",
                "values": [
                  "10",
                ],
              },
              {
                "config": {
                  "custom": {
                    "width": 150,
                  },
                  "displayNameFromDS": "Error",
                  "unit": "percent",
                },
                "name": "errorPercentage",
                "type": "string",
                "values": [
                  "10",
                ],
              },
              {
                "config": {
                  "custom": {
                    "width": 150,
                  },
                  "displayNameFromDS": "p50",
                  "unit": "ns",
                },
                "name": "p50",
                "type": "string",
                "values": [
                  "1",
                ],
              },
              {
                "config": {
                  "custom": {
                    "width": 150,
                  },
                  "displayNameFromDS": "p90",
                  "unit": "ns",
                },
                "name": "p90",
                "type": "string",
                "values": [
                  "2",
                ],
              },
              {
                "config": {
                  "custom": {
                    "width": 150,
                  },
                  "displayNameFromDS": "p95",
                  "unit": "ns",
                },
                "name": "p95",
                "type": "string",
                "values": [
                  "3",
                ],
              },
              {
                "config": {
                  "custom": {
                    "width": 150,
                  },
                  "displayNameFromDS": "p99",
                  "unit": "ns",
                },
                "name": "p99",
                "type": "string",
                "values": [
                  "4",
                ],
              },
            ],
            "length": 1,
            "meta": {
              "preferredVisualisationType": "table",
            },
            "name": "Metrics Summary",
            "refId": "metrics-summary",
          },
        ]
      `);
    });

    it('transformToMetricsData should return correctly', () => {
      const data = {
        spanCount: '10',
        errorSpanCount: '1',
        p50: '1',
        p90: '2',
        p95: '3',
        p99: '4',
        series,
      };
      const result = transformToMetricsData(data);
      expect(result).toMatchInlineSnapshot(`
        {
          "contains_sink": "true",
          "errorPercentage": "10",
          "kind": "server",
          "p50": "1",
          "p90": "2",
          "p95": "3",
          "p99": "4",
          "room": "kitchen",
          "span.http.status_code": 208,
          "spanCount": "10",
          "spanKind": "server",
          "spanStatus": "ok",
          "temperature": 38.1,
          "window_open": "8h",
        }
      `);
    });

    it('getConfigQuery should return correctly for empty target query', () => {
      const result = getConfigQuery(series, '{}');
      expect(result).toEqual(
        '{span.http.status_code=${__data.fields["span.http.status_code"]} && temperature=${__data.fields["temperature"]} && room="${__data.fields["room"]}" && contains_sink="${__data.fields["contains_sink"]}" && window_open="${__data.fields["window_open"]}" && spanStatus=${__data.fields["spanStatus"]} && spanKind=${__data.fields["spanKind"]} && kind=server}'
      );
    });

    it('getConfigQuery should return correctly for target query', () => {
      const result = getConfigQuery(series, '{name="HTTP POST - post"} | by(resource.service.name)');
      expect(result).toEqual(
        '{name="HTTP POST - post" && span.http.status_code=${__data.fields["span.http.status_code"]} && temperature=${__data.fields["temperature"]} && room="${__data.fields["room"]}" && contains_sink="${__data.fields["contains_sink"]}" && window_open="${__data.fields["window_open"]}" && spanStatus=${__data.fields["spanStatus"]} && spanKind=${__data.fields["spanKind"]} && kind=server} | by(resource.service.name)'
      );
    });

    it('getConfigQuery should return correctly for target query without brackets', () => {
      const result = getConfigQuery(series, 'by(resource.service.name)');
      expect(result).toEqual(
        '{span.http.status_code=${__data.fields["span.http.status_code"]} && temperature=${__data.fields["temperature"]} && room="${__data.fields["room"]}" && contains_sink="${__data.fields["contains_sink"]}" && window_open="${__data.fields["window_open"]}" && spanStatus=${__data.fields["spanStatus"]} && spanKind=${__data.fields["spanKind"]} && kind=server} | by(resource.service.name)'
      );
    });
  });
});

const series = [
  {
    key: 'span.http.status_code',
    value: {
      type: 3,
      n: 208,
    },
  },
  {
    key: 'temperature',
    value: {
      type: 4,
      f: 38.1,
    },
  },
  {
    key: 'room',
    value: {
      type: 5,
      s: 'kitchen',
    },
  },
  {
    key: 'contains_sink',
    value: {
      type: 6,
      b: 'true',
    },
  },
  {
    key: 'window_open',
    value: {
      type: 7,
      d: '8h',
    },
  },
  {
    key: 'spanStatus',
    value: {
      type: 8,
      status: 1,
    },
  },
  {
    key: 'spanKind',
    value: {
      type: 9,
      kind: 3,
    },
  },
];
