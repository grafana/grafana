import { clone } from 'lodash';

/**
 *
 * @param length - Number of values to add
 * @param start - First timestamp (ms)
 * @param step - step duration (ms)
 */
export const getMockTimeFrameArray = (length: number, start: number, step: number) => {
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
export const getMockValueFrameArray = (length: number, values = 0): number[] => {
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
