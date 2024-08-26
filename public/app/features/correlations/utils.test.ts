import { DataFrame, DataSourceInstanceSettings, FieldType, toDataFrame } from '@grafana/data';

import { CORR_TYPES } from './types';
import { CorrelationData } from './useCorrelations';
import { attachCorrelationsToDataFrames } from './utils';

describe('correlations utils', () => {
  it('attaches correlations defined in the configuration', () => {
    const { testDataFrames, correlations, refIdMap, prometheus, elastic } = setup();
    attachCorrelationsToDataFrames(testDataFrames, correlations, refIdMap);

    // Loki line (no links)
    expect(testDataFrames[0].fields[0].config.links).toHaveLength(0);
    // Loki traceId (linked to Prometheus and Elastic)
    expect(testDataFrames[0].fields[1].config.links).toHaveLength(2);
    expect(testDataFrames[0].fields[1].config.links).toMatchObject([
      {
        title: 'logs to metrics',
        internal: {
          datasourceUid: prometheus.uid,
          datasourceName: prometheus.name,
          query: {
            datasource: { uid: prometheus.uid },
            expr: 'target Prometheus query',
          },
        },
      },
      {
        title: 'logs to logs',
        internal: {
          datasourceUid: elastic.uid,
          datasourceName: elastic.name,
          query: {
            datasource: { uid: elastic.uid },
            expr: 'target Elastic query',
          },
        },
      },
    ]);

    // Elastic line (no links)
    expect(testDataFrames[1].fields[0].config.links).toHaveLength(0);
    // Elastic traceId (no links)
    expect(testDataFrames[1].fields[0].config.links).toHaveLength(0);

    // Prometheus value (linked to Elastic)
    expect(testDataFrames[2].fields[0].config.links).toHaveLength(1);
    expect(testDataFrames[2].fields[0].config.links![0]).toMatchObject({
      title: 'metrics to logs',
      internal: {
        datasourceUid: elastic.uid,
        datasourceName: elastic.name,
        query: {
          expr: 'target Elastic query',
        },
      },
    });
  });

  it('does not create duplicates when attaching links to the same data frame', () => {
    const { testDataFrames, correlations, refIdMap } = setup();
    attachCorrelationsToDataFrames(testDataFrames, correlations, refIdMap);
    attachCorrelationsToDataFrames(testDataFrames, correlations, refIdMap);

    // Loki traceId (linked to Prometheus and Elastic)
    expect(testDataFrames[0].fields[1].config.links).toHaveLength(2);
    // Elastic line (no links)
    expect(testDataFrames[1].fields[0].config.links).toHaveLength(0);
    // Prometheus value (linked to Elastic)
    expect(testDataFrames[2].fields[0].config.links).toHaveLength(1);
  });
});

function setup() {
  const loki = { uid: 'loki-uid', name: 'loki' } as DataSourceInstanceSettings;
  const elastic = { uid: 'elastic-uid', name: 'elastic' } as DataSourceInstanceSettings;
  const prometheus = { uid: 'prometheus-uid', name: 'prometheus' } as DataSourceInstanceSettings;

  const refIdMap = {
    'Loki Query': loki.uid,
    'Elastic Query': elastic.uid,
    'Prometheus Query': prometheus.uid,
  };

  const testDataFrames: DataFrame[] = [
    toDataFrame({
      name: 'Loki Logs',
      refId: 'Loki Query',
      fields: [
        { name: 'line', values: [] },
        { name: 'traceId', values: [] },
      ],
    }),
    toDataFrame({
      name: 'Elastic Logs',
      refId: 'Elastic Query',
      fields: [
        { name: 'line', values: [] },
        { name: 'traceId', values: [] },
      ],
    }),
    toDataFrame({
      name: 'Prometheus Metrics',
      refId: 'Prometheus Query',
      fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3, 4, 5] }],
    }),
  ];

  const correlations: CorrelationData[] = [
    {
      uid: 'loki-to-prometheus',
      label: 'logs to metrics',
      source: loki,
      target: prometheus,
      type: CORR_TYPES.query.value,
      config: { field: 'traceId', target: { expr: 'target Prometheus query' } },
      provisioned: false,
    },
    // Test multiple correlations attached to the same field
    {
      uid: 'loki-to-elastic',
      label: 'logs to logs',
      source: loki,
      target: elastic,
      type: CORR_TYPES.query.value,
      config: { field: 'traceId', target: { expr: 'target Elastic query' } },
      provisioned: false,
    },
    {
      uid: 'prometheus-to-elastic',
      label: 'metrics to logs',
      source: prometheus,
      target: elastic,
      type: CORR_TYPES.query.value,
      config: { field: 'value', target: { expr: 'target Elastic query' } },
      provisioned: false,
    },
  ];

  return { testDataFrames, correlations, refIdMap, prometheus, elastic };
}
