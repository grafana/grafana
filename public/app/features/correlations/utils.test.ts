import { DataFrame, DataSourceInstanceSettings, FieldType, toDataFrame } from '@grafana/data';

import { CorrelationData } from './useCorrelations';
import { attachCorrelationsToDataFrames } from './utils';

describe('correlations utils', () => {
  it('attaches correlations defined in the configuration', () => {
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
        config: { type: 'query', field: 'traceId', target: { expr: 'target Prometheus query' } },
      },
      {
        uid: 'prometheus-to-elastic',
        label: 'metrics to logs',
        source: prometheus,
        target: elastic,
        config: { type: 'query', field: 'value', target: { expr: 'target Elastic query' } },
      },
    ];

    attachCorrelationsToDataFrames(testDataFrames, correlations, refIdMap);

    // Loki line (no links)
    expect(testDataFrames[0].fields[0].config.links).toBeUndefined();
    // Loki traceId (linked to Prometheus)
    expect(testDataFrames[0].fields[1].config.links).toHaveLength(1);
    expect(testDataFrames[0].fields[1].config.links![0]).toMatchObject({
      title: 'logs to metrics',
      internal: {
        datasourceUid: prometheus.uid,
        datasourceName: prometheus.name,
        query: {
          expr: 'target Prometheus query',
        },
      },
    });

    // Elastic line (no links)
    expect(testDataFrames[1].fields[0].config.links).toBeUndefined();
    // Elastic traceId (no links)
    expect(testDataFrames[1].fields[0].config.links).toBeUndefined();

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
});
