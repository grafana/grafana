import { createDataFrame } from '@grafana/data';

export const mockTraceDataFrame = [
  createDataFrame({
    fields: [
      {
        name: 'traceID',
        values: ['04450900759028499335', '04450900759028499335', '04450900759028499335', '04450900759028499335'],
      },
      {
        name: 'spanID',
        values: ['4322526419282105830', '3095626263385822295', '6397320272727147889', '1853508259384889601'],
      },
      {
        name: 'parentSpanID',
        values: ['3095626263385822295', '3198122728676260175', '7501257416198979329', ''],
      },
      {
        name: 'operationName',
        values: [
          'store.validateQueryTimeRange',
          'store.validateQuery',
          'cachingIndexClient.cacheFetch',
          'Shipper.Uploads.Query',
        ],
      },
      {
        name: 'serviceName',
        values: ['service1', 'service1', 'service1', 'service1'],
      },
      {
        name: 'serviceTags',
        values: [
          [
            {
              value: 'service1',
              key: 'service.name',
            },
            {
              value: 'Zipkin-Go-2.25.0',
              key: 'opencensus.exporterversion',
            },
            {
              value: '708c78ea08c1',
              key: 'host.hostname',
            },
            {
              value: '172.18.0.3',
              key: 'ip',
            },
            {
              value: '632583de9a4a497b',
              key: 'client-uuid',
            },
          ],
          [
            {
              value: 'service1',
              key: 'service.name',
            },
            {
              value: 'Zipkin-Go-2.25.0',
              key: 'opencensus.exporterversion',
            },
            {
              value: '708c78ea08c1',
              key: 'host.hostname',
            },
            {
              value: '172.18.0.3',
              key: 'ip',
            },
            {
              value: '632583de9a4a497b',
              key: 'client-uuid',
            },
          ],
          [
            {
              value: 'service1',
              key: 'service.name',
            },
            {
              value: 'Zipkin-Go-2.25.0',
              key: 'opencensus.exporterversion',
            },
            {
              value: '708c78ea08c1',
              key: 'host.hostname',
            },
            {
              value: '172.18.0.3',
              key: 'ip',
            },
            {
              value: '632583de9a4a497b',
              key: 'client-uuid',
            },
          ],
          [
            {
              value: 'service1',
              key: 'service.name',
            },
            {
              value: 'Zipkin-Go-2.25.0',
              key: 'opencensus.exporterversion',
            },
            {
              value: '708c78ea08c1',
              key: 'host.hostname',
            },
            {
              value: '172.18.0.3',
              key: 'ip',
            },
            {
              value: '632583de9a4a497b',
              key: 'client-uuid',
            },
          ],
        ],
      },
      {
        name: 'startTime',
        values: [1619712655875.4539, 1619712655875.4502, 1619712655875.592, 1619712655875.653],
      },
      {
        name: 'duration',
        values: [0.004, 0.016, 0.039, 0.047],
      },
      {
        name: 'logs',
        values: [
          null,
          null,
          [
            {
              timestamp: 1619712655875.631,
              fields: [
                {
                  value: 'debug',
                  key: 'level',
                },
                {
                  value: 0,
                  key: 'hits',
                },
                {
                  value: 16,
                  key: 'misses',
                },
              ],
            },
          ],
          [
            {
              timestamp: 1619712655875.738,
              fields: [
                {
                  value: 'debug',
                  key: 'level',
                },
                {
                  value: 'index_18746',
                  key: 'table-name',
                },
                {
                  value: 16,
                  key: 'query-count',
                },
              ],
            },
            {
              timestamp: 1619712655875.773,
              fields: [
                {
                  value: 'debug',
                  key: 'level',
                },
                {
                  value: 'compactor-1619711145.gz',
                  key: 'queried-db',
                },
              ],
            },
            {
              timestamp: 1619712655875.794,
              fields: [
                {
                  value: 'debug',
                  key: 'level',
                },
                {
                  value: '708c78ea08c1-1619516350042748959-1619711100.gz',
                  key: 'queried-db',
                },
              ],
            },
          ],
        ],
      },
      {
        name: 'tags',
        values: [
          [
            {
              value: 0,
              key: 'status.code',
            },
          ],
          [
            {
              value: 0,
              key: 'status.code',
            },
          ],
          [
            {
              value: 0,
              key: 'status.code',
            },
          ],
          [
            {
              value: 0,
              key: 'status.code',
            },
          ],
        ],
      },
    ],
  }),
];
