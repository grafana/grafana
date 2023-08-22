import { LoadingState } from '@grafana/data';

import { defaultSettings } from './datasource.test';
import { createTableFrameFromMetricsSummaryQuery, emptyResponse } from './metricsSummary';

describe('MetricsSummary', () => {
  describe('createTableFrameFromMetricsSummaryQuery', () => {
    it('should return emptyResponse when state is LoadingState.Error', () => {
      const result = createTableFrameFromMetricsSummaryQuery([], '', defaultSettings, LoadingState.Error);
      expect(result).toEqual([emptyResponse]);
    });

    it('should return correctly when state is LoadingState.Loading', () => {
      const result = createTableFrameFromMetricsSummaryQuery([], '', defaultSettings, LoadingState.Loading);
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "fields": [
              {
                "config": {
                  "custom": {
                    "width": 300,
                  },
                  "displayNameFromDS": "State",
                },
                "labels": undefined,
                "name": "state",
                "type": "string",
                "values": [
                  "Loading...",
                ],
              },
            ],
            "meta": {
              "preferredVisualisationType": "table",
            },
            "name": "Metrics Summary",
            "refId": "metrics-summary",
          },
        ]
      `);
    });

    it('should return correctly when state is LoadingState.Done', () => {
      const data = [
        {
          spanCount: '10',
          errorSpanCount: '0',
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
          ],
        },
      ];
      const result = createTableFrameFromMetricsSummaryQuery(
        data,
        '{name="HTTP POST - post"} | by(resource.service.name)',
        defaultSettings,
        LoadingState.Done
      );
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "creator": [Function],
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
                          "query": "{name="HTTP POST - post" && span.http.status_code=\${__data.fields["span.http.status_code"]}} | by(resource.service.name)",
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
                  "0",
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
            "first": [
              208,
            ],
            "length": 1,
            "meta": {
              "preferredVisualisationType": "table",
            },
            "name": "Metrics Summary",
            "parsers": undefined,
            "refId": "metrics-summary",
          },
        ]
      `);
    });
  });
});
