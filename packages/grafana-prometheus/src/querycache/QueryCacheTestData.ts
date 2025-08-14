// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querycache/QueryCacheTestData.ts
import { clone } from 'lodash';

/**
 *
 * @param length - Number of values to add
 * @param start - First timestamp (ms)
 * @param step - step duration (ms)
 */
const getMockTimeFrameArray = (length: number, start: number, step: number) => {
  let timeValues: number[] = [];
  for (let i = 0; i < length; i++) {
    timeValues.push(start + i * step);
  }

  return timeValues;
};

/**
 * @param length - number of "Values" to add
 * @param values
 * @param high
 */
const getMockValueFrameArray = (length: number, values = 0): number[] => {
  return Array(length).fill(values);
};

const timeFrameWithMissingValuesInMiddle = getMockTimeFrameArray(721, 1675262550000, 30000);
const timeFrameWithMissingValuesAtStart = getMockTimeFrameArray(721, 1675262550000, 30000);
const timeFrameWithMissingValuesAtEnd = getMockTimeFrameArray(721, 1675262550000, 30000);

// Deleting some out the middle
timeFrameWithMissingValuesInMiddle.splice(360, 721 - 684);
timeFrameWithMissingValuesAtStart.splice(0, 721 - 684);
timeFrameWithMissingValuesAtEnd.splice(721 - 684, 721 - 684);

const mockLabels = {
  __name__: 'cortex_request_duration_seconds_bucket',
  cluster: 'dev-us-central-0',
  container: 'aggregator',
  instance: 'aggregator-7:aggregator:http-metrics',
  job: 'mimir-dev-11/aggregator',
  le: '0.5',
  method: 'GET',
  namespace: 'mimir-dev-11',
  pod: 'aggregator-7',
  route: 'metrics',
  status_code: '200',
  ws: 'false',
};

const twoRequestsOneCachedMissingData = {
  first: {
    request: {
      app: 'panel-viewer',
      requestId: 'Q100',
      panelId: 19,
      dashboardId: 884,
      dashboardUID: 'dtngicc4z',
      range: {
        from: '2023-02-01T14:42:54.929Z',
        to: '2023-02-01T20:42:54.929Z',
        raw: { from: 'now-6h', to: 'now' },
      },
      interval: '30s',
      intervalMs: 30000,
      targets: [
        {
          datasource: { type: 'prometheus', uid: 'OPQv8Kc4z' },
          editorMode: 'code',
          expr: '',
          legendFormat: '',
          range: true,
          refId: 'A',
          exemplar: false,
          requestId: '19A',
          utcOffsetSec: -21600,
        },
      ],
      startTime: 1675284174929,
      rangeRaw: { from: 'now-6h', to: 'now' },
    },
    dataFrames: [
      {
        name: '+Inf',
        refId: 'A',
        fields: [
          {
            name: 'Time',
            type: 'time',
            typeInfo: { frame: 'time.Time' },
            config: { interval: 30000 },
            // Delete values from the middle
            values: timeFrameWithMissingValuesInMiddle,
            entities: {},
          },
          {
            name: 'Value',
            type: 'number',
            typeInfo: { frame: 'float64' },
            labels: { ...mockLabels, le: '+Inf' },
            config: { displayNameFromDS: '+Inf' },
            values: getMockValueFrameArray(684, 1),
            entities: {},
          },
        ],
        length: 684,
      },
      {
        name: '0.5',
        refId: 'A',
        meta: {
          type: 'timeseries-multi',
          custom: { resultType: 'matrix' },
          executedQueryString:
            'Expr: {__name__="cortex_request_duration_seconds_bucket", cluster="dev-us-central-0", container="aggregator", instance=~"aggregator-7:aggregator:http-metrics|aggregator-6:aggregator:http-metrics", job="mimir-dev-11/aggregator", le=~"\\\\+Inf|0.5", method="GET", namespace="mimir-dev-11", pod="aggregator-7"}\nStep: 30s',
          preferredVisualisationType: 'graph',
        },
        fields: [
          {
            name: 'Time',
            type: 'time',
            typeInfo: { frame: 'time.Time' },
            config: { interval: 30000 },
            values: timeFrameWithMissingValuesInMiddle,
            entities: {},
          },
          {
            name: 'Value',
            type: 'number',
            typeInfo: { frame: 'float64' },
            labels: { ...mockLabels, le: '0.5' },
            config: { displayNameFromDS: '0.5' },
            values: getMockValueFrameArray(684, 25349),
            entities: {},
          },
        ],
        length: 684,
      },
    ],
    originalRange: undefined,
    timeSrv: { from: 'now-6h', to: 'now' },
  },
  second: {
    request: {
      app: 'panel-viewer',
      requestId: 'Q101',
      timezone: 'browser',
      panelId: 19,
      dashboardId: 884,
      dashboardUID: 'dtngicc4z',
      publicDashboardAccessToken: '',
      range: {
        from: '2023-02-01T14:44:01.928Z',
        to: '2023-02-01T20:44:01.928Z',
        raw: { from: 'now-6h', to: 'now' },
      },
      timeInfo: '',
      interval: '30s',
      intervalMs: 30000,
      targets: [
        {
          datasource: { type: 'prometheus', uid: 'OPQv8Kc4z' },
          editorMode: 'code',
          expr: '{__name__="cortex_request_duration_seconds_bucket", cluster="dev-us-central-0", container="aggregator", instance=~"aggregator-7:aggregator:http-metrics|aggregator-6:aggregator:http-metrics", job="mimir-dev-11/aggregator", le=~"\\\\+Inf|0.5", method="GET", namespace="mimir-dev-11", pod="aggregator-7"}',
          legendFormat: '{{le}}',
          range: true,
          refId: 'A',
          exemplar: false,
          requestId: '19A',
          utcOffsetSec: -21600,
        },
      ],
      maxDataPoints: 775,
      scopedVars: { __interval: { text: '30s', value: '30s' }, __interval_ms: { text: '30000', value: 30000 } },
      startTime: 1675284241929,
      rangeRaw: { from: 'now-6h', to: 'now' },
    },
    dataFrames: [
      {
        name: '+Inf',
        refId: 'A',
        meta: {
          type: 'timeseries-multi',
          custom: { resultType: 'matrix' },
          executedQueryString:
            'Expr: {__name__="cortex_request_duration_seconds_bucket", cluster="dev-us-central-0", container="aggregator", instance=~"aggregator-7:aggregator:http-metrics|aggregator-6:aggregator:http-metrics", job="mimir-dev-11/aggregator", le=~"\\\\+Inf|0.5", method="GET", namespace="mimir-dev-11", pod="aggregator-7"}\nStep: 30s',
          preferredVisualisationType: 'graph',
        },
        fields: [
          {
            name: 'Time',
            type: 'time',
            typeInfo: { frame: 'time.Time' },
            config: { interval: 30000 },
            values: getMockTimeFrameArray(24, 1675283550000, 30000),
            entities: {},
          },
          {
            name: 'Value',
            type: 'number',
            typeInfo: { frame: 'float64' },
            labels: { ...mockLabels, le: '+Inf' },
            config: { displayNameFromDS: '+Inf' },
            values: getMockValueFrameArray(24, 1),
            entities: {},
          },
        ],
        length: 24,
      },
      {
        name: '0.5',
        refId: 'A',
        meta: {
          type: 'timeseries-multi',
          custom: { resultType: 'matrix' },
          executedQueryString:
            'Expr: {__name__="cortex_request_duration_seconds_bucket", cluster="dev-us-central-0", container="aggregator", instance=~"aggregator-7:aggregator:http-metrics|aggregator-6:aggregator:http-metrics", job="mimir-dev-11/aggregator", le=~"\\\\+Inf|0.5", method="GET", namespace="mimir-dev-11", pod="aggregator-7"}\nStep: 30s',
          preferredVisualisationType: 'graph',
        },
        fields: [
          {
            name: 'Time',
            type: 'time',
            typeInfo: { frame: 'time.Time' },
            config: { interval: 30000 },
            values: getMockTimeFrameArray(21, 1675283550000, 30000),
            entities: {},
          },
          {
            name: 'Value',
            type: 'number',
            typeInfo: { frame: 'float64' },
            labels: {
              __name__: 'cortex_request_duration_seconds_bucket',
              cluster: 'dev-us-central-0',
              container: 'aggregator',
              instance: 'aggregator-7:aggregator:http-metrics',
              job: 'mimir-dev-11/aggregator',
              le: '0.5',
              method: 'GET',
              namespace: 'mimir-dev-11',
              pod: 'aggregator-7',
              route: 'metrics',
              status_code: '200',
              ws: 'false',
            },
            config: { displayNameFromDS: '0.5' },
            values: getMockValueFrameArray(21, 2),
            entities: {},
          },
        ],
        length: 21,
      },
    ],
    originalRange: { end: 1675284241920, start: 1675262641920 },
    timeSrv: { from: 'now-6h', to: 'now' },
  },
};

export const trimmedFirstPointInPromFrames = [
  {
    refId: 'A',
    meta: {
      type: 'timeseries-multi',
      typeVersion: [0, 1],
      custom: {
        resultType: 'matrix',
      },
      executedQueryString: 'Expr: ecs_cpu_seconds_total\nStep: 1m0s',
    },
    fields: [
      {
        name: 'Time',
        type: 'time',
        typeInfo: {
          frame: 'time.Time',
        },
        config: {
          interval: 60000,
        },
        values: [1726835100000, 1726835160000, 1726835220000, 1726835280000, 1726835340000, 1726835400000],
        entities: {},
      },
      {
        name: 'ecs_cpu_seconds_total',
        type: 'number',
        typeInfo: {
          frame: 'float64',
        },
        labels: {
          __name__: 'ecs_cpu_seconds_total',
          container: 'browser-container',
          cpu: '0',
          environment: 'staging',
          instance: 'localhost:9779',
          job: 'node',
          task_id: '7eaae23357564449bbde3d6b8aa3d171',
          test_run_id: '178196',
        },
        config: {},
        values: [148.528672986, 148.535654343, 148.535654343, 148.535654343, 148.535654343, 148.535654343],
        entities: {},
      },
    ],
    length: 6,
  },
  {
    refId: 'A',
    meta: {
      type: 'timeseries-multi',
      typeVersion: [0, 1],
      custom: {
        resultType: 'matrix',
      },
    },
    fields: [
      {
        name: 'Time',
        type: 'time',
        typeInfo: {
          frame: 'time.Time',
        },
        config: {
          interval: 60000,
        },
        values: [
          1726835100000, 1726835160000, 1726835220000, 1726835280000, 1726835340000, 1726835400000, 1726835460000,
          1726835520000, 1726835580000, 1726835640000, 1726835700000, 1726835760000, 1726835820000, 1726835880000,
          1726835940000, 1726836000000,
        ],
        entities: {},
      },
      {
        name: 'ecs_cpu_seconds_total',
        type: 'number',
        typeInfo: {
          frame: 'float64',
        },
        labels: {
          __name__: 'ecs_cpu_seconds_total',
          container: 'browser-container',
          cpu: '0',
          environment: 'staging',
          instance: 'localhost:9779',
          job: 'node',
          task_id: '800bedb7d7434ee69251e1d72aa24ee4',
        },
        config: {},
        values: [
          18.273081476, 18.27823287, 18.28002373, 18.281447944, 18.282133248, 18.283555666, 18.28503474, 18.287278624,
          18.290889095, 18.295363816, 18.29912598, 18.301647198, 18.305721365, 18.313378915, 18.31617255, 18.32104371,
        ],
        entities: {},
      },
    ],
    length: 16,
  },
  {
    refId: 'A',
    meta: {
      type: 'timeseries-multi',
      typeVersion: [0, 1],
      custom: {
        resultType: 'matrix',
      },
    },
    fields: [
      {
        name: 'Time',
        type: 'time',
        typeInfo: {
          frame: 'time.Time',
        },
        config: {
          interval: 60000,
        },
        values: [1726835100000, 1726835160000, 1726835220000, 1726835280000, 1726835340000, 1726835400000],
        entities: {},
      },
      {
        name: 'ecs_cpu_seconds_total',
        type: 'number',
        typeInfo: {
          frame: 'float64',
        },
        labels: {
          __name__: 'ecs_cpu_seconds_total',
          container: 'browser-container',
          cpu: '1',
          environment: 'staging',
          instance: 'localhost:9779',
          job: 'node',
          task_id: '7eaae23357564449bbde3d6b8aa3d171',
          test_run_id: '178196',
        },
        config: {},
        values: [147.884430886, 147.893771728, 147.893771728, 147.893771728, 147.893771728, 147.893771728],
        entities: {},
      },
    ],
    length: 6,
  },
];

export const IncrementalStorageDataFrameScenarios = {
  histogram: {
    // 3 requests, one 30 seconds after the first, and then the user waits a minute and shortens to a 5 minute query window from 1 hour to force frames to get evicted
    evictionRequests: {
      first: {
        request: {
          range: {
            from: '2023-01-30T19:33:01.332Z',
            to: '2023-01-30T20:33:01.332Z',
            raw: { from: 'now-1h', to: 'now' },
          },
          interval: '15s',
          intervalMs: 15000,
          targets: [
            {
              datasource: { type: 'prometheus', uid: 'OPQv8Kc4z' },
              editorMode: 'code',
              exemplar: false,
              expr: 'sum by(le) (rate(cortex_request_duration_seconds_bucket{cluster="dev-us-central-0", job="cortex-dev-01/cortex-gw-internal", namespace="cortex-dev-01"}[$__rate_interval]))',
              format: 'heatmap',
              legendFormat: '{{le}}',
              range: true,
              refId: 'A',
              requestId: '2A',
              utcOffsetSec: -21600,
            },
          ],
          maxDataPoints: 871,
          scopedVars: {
            __interval: { text: '15s', value: '15s' },
            __interval_ms: { text: '15000', value: 15000 },
          },
          startTime: 1675110781332,
          rangeRaw: { from: 'now-1h', to: 'now' },
        },
        dataFrames: [
          {
            name: '0.005',
            refId: 'A',
            meta: {
              type: 'heatmap-rows',
              custom: { resultType: 'matrix' },
              executedQueryString:
                'Expr: sum by(le) (rate(cortex_request_duration_seconds_bucket{cluster="dev-us-central-0", job="cortex-dev-01/cortex-gw-internal", namespace="cortex-dev-01"}[1m0s]))\nStep: 15s',
            },
            fields: [
              {
                name: 'Time',
                type: 'time',
                typeInfo: { frame: 'time.Time' },
                config: { interval: 15000 },
                values: getMockTimeFrameArray(241, 1675107180000, 15000),
                entities: {},
              },
              {
                name: '0.005',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.005' },
                config: { displayNameFromDS: '0.005' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '0.01',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.01' },
                config: { displayNameFromDS: '0.01' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '0.025',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.025' },
                config: { displayNameFromDS: '0.025' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '0.05',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.05' },
                config: { displayNameFromDS: '0.05' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '0.1',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.1' },
                config: { displayNameFromDS: '0.1' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '0.25',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.25' },
                config: { displayNameFromDS: '0.25' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '0.5',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.5' },
                config: { displayNameFromDS: '0.5' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '1.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '1.0' },
                config: { displayNameFromDS: '1.0' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '2.5',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '2.5' },
                config: { displayNameFromDS: '2.5' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '5.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '5.0' },
                config: { displayNameFromDS: '5.0' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '10.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '10.0' },
                config: { displayNameFromDS: '10.0' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '25.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '25.0' },
                config: { displayNameFromDS: '25.0' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '50.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '50.0' },
                config: { displayNameFromDS: '50.0' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '100.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '100.0' },
                config: { displayNameFromDS: '100.0' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
              {
                name: '+Inf',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '+Inf' },
                config: { displayNameFromDS: '+Inf' },
                values: getMockValueFrameArray(241, 2.8),
                entities: {},
              },
            ],
            length: 241,
          },
        ],
      },
      second: {
        request: {
          range: {
            from: '2023-01-30T19:33:31.357Z',
            to: '2023-01-30T20:33:31.357Z',
            raw: { from: 'now-1h', to: 'now' },
          },
          interval: '15s',
          intervalMs: 15000,
          targets: [
            {
              datasource: { type: 'prometheus' },
              editorMode: 'code',
              exemplar: false,
              expr: 'sum by(le) (rate(cortex_request_duration_seconds_bucket{cluster="dev-us-central-0", job="cortex-dev-01/cortex-gw-internal", namespace="cortex-dev-01"}[$__rate_interval]))',
              format: 'heatmap',
              legendFormat: '{{le}}',
              range: true,
              refId: 'A',
              requestId: '2A',
              utcOffsetSec: -21600,
            },
          ],
          maxDataPoints: 871,
          scopedVars: {
            __interval: { text: '15s', value: '15s' },
            __interval_ms: { text: '15000', value: 15000 },
          },
          startTime: 1675110811357,
          rangeRaw: { from: 'now-1h', to: 'now' },
        },
        dataFrames: [
          {
            name: '0.005',
            refId: 'A',
            meta: {
              type: 'heatmap-rows',
              custom: { resultType: 'matrix' },
              executedQueryString:
                'Expr: sum by(le) (rate(cortex_request_duration_seconds_bucket{cluster="dev-us-central-0", job="cortex-dev-01/cortex-gw-internal", namespace="cortex-dev-01"}[1m0s]))\nStep: 15s',
            },
            fields: [
              {
                name: 'Time',
                type: 'time',
                typeInfo: { frame: 'time.Time' },
                config: { interval: 15000 },
                values: getMockTimeFrameArray(43, 1675110180000, 15000),
                entities: {},
              },
              {
                name: '0.005',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.005' },
                config: { displayNameFromDS: '0.005' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '0.01',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.01' },
                config: { displayNameFromDS: '0.01' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '0.025',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.025' },
                config: { displayNameFromDS: '0.025' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '0.05',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.05' },
                config: { displayNameFromDS: '0.05' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '0.1',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.1' },
                config: { displayNameFromDS: '0.1' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '0.25',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.25' },
                config: { displayNameFromDS: '0.25' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '0.5',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.5' },
                config: { displayNameFromDS: '0.5' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '1.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '1.0' },
                config: { displayNameFromDS: '1.0' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '2.5',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '2.5' },
                config: { displayNameFromDS: '2.5' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '5.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '5.0' },
                config: { displayNameFromDS: '5.0' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '10.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '10.0' },
                config: { displayNameFromDS: '10.0' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '25.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '25.0' },
                config: { displayNameFromDS: '25.0' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '50.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '50.0' },
                config: { displayNameFromDS: '50.0' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '100.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '100.0' },
                config: { displayNameFromDS: '100.0' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
              {
                name: '+Inf',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '+Inf' },
                config: { displayNameFromDS: '+Inf' },
                values: getMockValueFrameArray(43, 2.8),
                entities: {},
              },
            ],
            length: 43,
          },
        ],
      },
      third: {
        request: {
          range: {
            from: '2023-01-30T20:33:31.357Z',
            to: '2023-01-30T20:34:31.357Z',
            raw: { from: 'now-5m', to: 'now' },
          },
          interval: '15s',
          intervalMs: 15000,
          targets: [
            {
              datasource: { type: 'prometheus' },
              editorMode: 'code',
              exemplar: false,
              expr: 'sum by(le) (rate(cortex_request_duration_seconds_bucket{cluster="dev-us-central-0", job="cortex-dev-01/cortex-gw-internal", namespace="cortex-dev-01"}[$__rate_interval]))',
              format: 'heatmap',
              legendFormat: '{{le}}',
              range: true,
              refId: 'A',
              requestId: '2A',
              utcOffsetSec: -21600,
            },
          ],
          maxDataPoints: 871,
          scopedVars: {
            __interval: { text: '15s', value: '15s' },
            __interval_ms: { text: '15000', value: 15000 },
          },
          startTime: 1675110811357,
          rangeRaw: { from: 'now-1h', to: 'now' },
        },
        dataFrames: [
          {
            name: '0.005',
            refId: 'A',
            meta: {
              type: 'heatmap-rows',
              custom: { resultType: 'matrix' },
              executedQueryString:
                'Expr: sum by(le) (rate(cortex_request_duration_seconds_bucket{cluster="dev-us-central-0", job="cortex-dev-01/cortex-gw-internal", namespace="cortex-dev-01"}[1m0s]))\nStep: 15s',
            },
            fields: [
              {
                name: 'Time',
                type: 'time',
                typeInfo: { frame: 'time.Time' },
                config: { interval: 15000 },
                values: getMockTimeFrameArray(20, 1675110810000, 15000),
                entities: {},
              },
              {
                name: '0.005',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.005' },
                config: { displayNameFromDS: '0.005' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '0.01',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.01' },
                config: { displayNameFromDS: '0.01' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '0.025',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.025' },
                config: { displayNameFromDS: '0.025' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '0.05',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.05' },
                config: { displayNameFromDS: '0.05' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '0.1',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.1' },
                config: { displayNameFromDS: '0.1' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '0.25',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.25' },
                config: { displayNameFromDS: '0.25' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },

              // Sometimes we don't always get new values, the preprocessing will need to back-fill any missing values
              {
                name: '0.5',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '0.5' },
                config: { displayNameFromDS: '0.5' },
                values: getMockValueFrameArray(10, 4.3),
                entities: {},
              },
              {
                name: '1.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '1.0' },
                config: { displayNameFromDS: '1.0' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '2.5',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '2.5' },
                config: { displayNameFromDS: '2.5' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '5.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '5.0' },
                config: { displayNameFromDS: '5.0' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '10.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '10.0' },
                config: { displayNameFromDS: '10.0' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '25.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '25.0' },
                config: { displayNameFromDS: '25.0' },
                values: getMockValueFrameArray(10, 4.3),
                entities: {},
              },
              {
                name: '50.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '50.0' },
                config: { displayNameFromDS: '50.0' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '100.0',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '100.0' },
                config: { displayNameFromDS: '100.0' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
              {
                name: '+Inf',
                type: 'number',
                typeInfo: { frame: 'float64' },
                labels: { le: '+Inf' },
                config: { displayNameFromDS: '+Inf' },
                values: getMockValueFrameArray(20, 4.3),
                entities: {},
              },
            ],
            length: 43,
          },
        ],
      },
    },

    getSeriesWithGapAtEnd: (countOfSeries = 2) => {
      const templateClone = clone(twoRequestsOneCachedMissingData);
      for (let i = 0; i < countOfSeries - 1; i++) {
        templateClone.first.dataFrames[i].fields[0].values = timeFrameWithMissingValuesAtEnd;
      }
      return templateClone;
    },

    getSeriesWithGapAtStart: (countOfSeries = 2) => {
      const templateClone = clone(twoRequestsOneCachedMissingData);
      for (let i = 0; i < countOfSeries - 1; i++) {
        templateClone.first.dataFrames[i].fields[0].values = timeFrameWithMissingValuesAtStart;
      }
      return templateClone;
    },

    getSeriesWithGapInMiddle: (countOfSeries = 2) => {
      const templateClone = clone(twoRequestsOneCachedMissingData);
      for (let i = 0; i < countOfSeries - 1; i++) {
        templateClone.first.dataFrames[i].fields[0].values = timeFrameWithMissingValuesInMiddle;
      }
      return templateClone;
    },
  },
};

export const differentDisplayNameFromDS = {
  first: {
    dataFrames: [
      {
        refId: 'A',
        meta: {
          type: 'timeseries-multi',
          typeVersion: [0, 1],
          custom: {
            resultType: 'matrix',
          },
          executedQueryString:
            'Expr: sum by (org, stackId)(count_over_time(hosted_grafana:grafana_datasource_loki_orgs_stacks_queries:count2m{org=~".*", stackId=~".*"}[5m]))\nStep: 5m0s',
        },
        fields: [
          {
            name: 'Time',
            type: 'time',
            typeInfo: {
              frame: 'time.Time',
            },
            config: {
              interval: 300000,
            },
            values: [1726829100000, 1726829400000, 1726829700000],
            entities: {},
          },
          {
            name: 'Value',
            type: 'number',
            typeInfo: {
              frame: 'float64',
            },
            labels: {
              org: 'rutgerkerkhoffdevuseast',
              stackId: '2791',
            },
            config: {
              displayNameFromDS: 'rutgerkerkhoffdevuseast-customLegend',
            },
            values: [3, 2, 3],
            entities: {},
          },
        ],
        length: 3,
      },
      {
        refId: 'A',
        meta: {
          type: 'timeseries-multi',
          typeVersion: [0, 1],
          custom: {
            resultType: 'matrix',
          },
        },
        fields: [
          {
            name: 'Time',
            type: 'time',
            typeInfo: {
              frame: 'time.Time',
            },
            config: {
              interval: 300000,
            },
            values: [1726829100000, 1726829400000, 1726829700000],
            entities: {},
          },
          {
            name: 'Value',
            type: 'number',
            typeInfo: {
              frame: 'float64',
            },
            labels: {
              org: 'securityops',
              stackId: '1533',
            },
            config: {
              displayNameFromDS: 'securityops-customLegend',
            },
            values: [3, 2, 3],
            entities: {},
          },
        ],
        length: 3,
      },
      {
        refId: 'A',
        meta: {
          type: 'timeseries-multi',
          typeVersion: [0, 1],
          custom: {
            resultType: 'matrix',
          },
        },
        fields: [
          {
            name: 'Time',
            type: 'time',
            typeInfo: {
              frame: 'time.Time',
            },
            config: {
              interval: 300000,
            },
            values: [1726829100000, 1726829400000, 1726829700000],
            entities: {},
          },
          {
            name: 'Value',
            type: 'number',
            typeInfo: {
              frame: 'float64',
            },
            labels: {
              org: 'stephaniehingtgen',
              stackId: '3740',
            },
            config: {
              displayNameFromDS: 'stephaniehingtgen-customLegend',
            },
            values: [3, 2, 3],
            entities: {},
          },
        ],
        length: 3,
      },
    ],
  },
  second: {
    dataFrames: [
      {
        refId: 'A',
        meta: {
          type: 'timeseries-multi',
          typeVersion: [0, 1],
          custom: {
            resultType: 'matrix',
          },
          executedQueryString:
            'Expr: sum by (org, stackId)(count_over_time(hosted_grafana:grafana_datasource_loki_orgs_stacks_queries:count2m{org=~".*", stackId=~".*"}[5m]))\nStep: 5m0s',
        },
        fields: [
          {
            name: 'Time',
            type: 'time',
            typeInfo: {
              frame: 'time.Time',
            },
            config: {
              interval: 300000,
            },
            values: [1726829100000, 1726829400000, 1726829700000],
            entities: {},
          },
          {
            name: 'Value',
            type: 'number',
            typeInfo: {
              frame: 'float64',
            },
            labels: {
              org: 'rutgerkerkhoffdevuseast',
              stackId: '2791',
            },
            config: {},
            values: [3, 2, 3],
            entities: {},
          },
        ],
        length: 3,
      },
      {
        refId: 'A',
        meta: {
          type: 'timeseries-multi',
          typeVersion: [0, 1],
          custom: {
            resultType: 'matrix',
          },
        },
        fields: [
          {
            name: 'Time',
            type: 'time',
            typeInfo: {
              frame: 'time.Time',
            },
            config: {
              interval: 300000,
            },
            values: [1726829100000, 1726829400000, 1726829700000],
            entities: {},
          },
          {
            name: 'Value',
            type: 'number',
            typeInfo: {
              frame: 'float64',
            },
            labels: {
              org: 'securityops',
              stackId: '1533',
            },
            config: {},
            values: [3, 2, 3],
            entities: {},
          },
        ],
        length: 3,
      },
      {
        refId: 'A',
        meta: {
          type: 'timeseries-multi',
          typeVersion: [0, 1],
          custom: {
            resultType: 'matrix',
          },
        },
        fields: [
          {
            name: 'Time',
            type: 'time',
            typeInfo: {
              frame: 'time.Time',
            },
            config: {
              interval: 300000,
            },
            values: [1726829100000, 1726829400000, 1726829700000],
            entities: {},
          },
          {
            name: 'Value',
            type: 'number',
            typeInfo: {
              frame: 'float64',
            },
            labels: {
              org: 'stephaniehingtgen',
              stackId: '3740',
            },
            config: {},
            values: [3, 2, 3],
            entities: {},
          },
        ],
        length: 3,
      },
    ],
  },
};
