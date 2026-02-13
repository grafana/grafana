import { generatedAPI as correlationsAPIv0alpha1 } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { DataFrame, DataFrameType, DataSourceInstanceSettings, FieldType, toDataFrame } from '@grafana/data';
import { config, CorrelationData } from '@grafana/runtime';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import * as utils from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({
      getRef: () => {
        return { type: 'testTypeFromLookup', uid: 'testUidFromLookup' };
      },
    }),
  }),
}));

describe('correlations utils', () => {
  it('attaches correlations defined in the configuration', () => {
    config.featureToggles.lokiLogsDataplane = false;
    const { testDataFrames, correlations, refIdMap, prometheus, elastic } = setup();
    utils.attachCorrelationsToDataFrames(testDataFrames, correlations, refIdMap);

    // Loki line
    expect(testDataFrames[0].fields[0].config.links).toHaveLength(1);
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
    utils.attachCorrelationsToDataFrames(testDataFrames, correlations, refIdMap);
    utils.attachCorrelationsToDataFrames(testDataFrames, correlations, refIdMap);

    // Loki traceId (linked to Prometheus and Elastic)
    expect(testDataFrames[0].fields[1].config.links).toHaveLength(2);
    // Elastic line (no links)
    expect(testDataFrames[1].fields[0].config.links).toHaveLength(0);
    // Prometheus value (linked to Elastic)
    expect(testDataFrames[2].fields[0].config.links).toHaveLength(1);
  });

  it('changes the config field if loki dataplane is being used and the correlation is pointing to the legacy body field (Line)', () => {
    const originalDataplaneState = config.featureToggles.lokiLogsDataplane;
    config.featureToggles.lokiLogsDataplane = true;
    const { correlations, refIdMap } = setup();
    const testDataFrame = toDataFrame({
      name: 'Loki Logs',
      refId: 'Loki Query',
      fields: [
        { name: 'timestamp', values: [], type: FieldType.time },
        { name: 'body', values: [], type: FieldType.string },
        { name: 'traceId', values: [], type: FieldType.string },
      ],
      meta: { type: DataFrameType.LogLines },
    });
    const dataFrameOut = utils.attachCorrelationsToDataFrames([testDataFrame], [correlations[3]], refIdMap);
    expect(dataFrameOut[0].fields[1].config.links).toHaveLength(1);
    config.featureToggles.lokiLogsDataplane = originalDataplaneState;
  });

  describe('getCorrelationsFromStorage', () => {
    const originalFeatureToggles = config.featureToggles;

    const listCorrelationK8sMock = jest.spyOn(correlationsAPIv0alpha1.endpoints.listCorrelation, 'initiate');
    const getCorrelationsLegacyMock = jest
      .spyOn(utils, 'getCorrelationsBySourceUIDs')
      .mockResolvedValue({ correlations: [], page: 0, limit: 100, totalCount: 0 });

    afterEach(() => {
      config.featureToggles = originalFeatureToggles;
      jest.clearAllMocks();
    });

    it('gets correlations data from app platform if flag is on', async () => {
      const unsubscribe = jest.fn();
      const subscription = { unsubscribe };
      const dispatch = jest.fn(() => subscription);
      config.featureToggles = { ...originalFeatureToggles, kubernetesCorrelations: true };

      await utils.getCorrelationsFromStorage(dispatch, [], 'test');
      expect(listCorrelationK8sMock).toHaveBeenCalled();
      expect(getCorrelationsLegacyMock).not.toHaveBeenCalled();
    });

    it('gets correlations data from legacy if flag is off', async () => {
      const unsubscribe = jest.fn();
      const subscription = { unsubscribe };
      const dispatch = jest.fn(() => subscription);
      config.featureToggles = { ...originalFeatureToggles, kubernetesCorrelations: false };

      await utils.getCorrelationsFromStorage(dispatch, [], 'test');
      expect(listCorrelationK8sMock).not.toHaveBeenCalled();
      expect(getCorrelationsLegacyMock).toHaveBeenCalled();
    });

    it('for K8s, gets datasource list from queries if instance datasource is mixed', async () => {
      const unsubscribe = jest.fn();
      const subscription = { unsubscribe };
      const dispatch = jest.fn(() => subscription);
      config.featureToggles = { ...originalFeatureToggles, kubernetesCorrelations: true };
      await utils.getCorrelationsFromStorage(
        dispatch,
        [{ refId: 'test', datasource: { uid: 'testUid', type: 'testType' } }],
        MIXED_DATASOURCE_NAME
      );
      expect(listCorrelationK8sMock).toHaveBeenCalledWith({
        labelSelector: 'correlations.grafana.app/sourceDS-ref in (testType.testUid)',
      });
      expect(getCorrelationsLegacyMock).not.toHaveBeenCalled();
    });
    it('for K8s, gets datasource list from instance if not mixed', async () => {
      const unsubscribe = jest.fn();
      const subscription = { unsubscribe };
      const dispatch = jest.fn(() => subscription);
      config.featureToggles = { ...originalFeatureToggles, kubernetesCorrelations: true };
      await utils.getCorrelationsFromStorage(
        dispatch,
        [{ refId: 'test', datasource: { uid: 'testUIdNoShow', type: 'testTypeNoShow' } }],
        'testUid'
      );
      expect(listCorrelationK8sMock).toHaveBeenCalledWith({
        labelSelector: 'correlations.grafana.app/sourceDS-ref in (testTypeFromLookup.testUidFromLookup)',
      });
      expect(getCorrelationsLegacyMock).not.toHaveBeenCalled();
    });
  });
});

function setup() {
  const loki = { uid: 'loki-uid', name: 'loki', meta: { id: 'loki' } } as DataSourceInstanceSettings;
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
        { name: 'Line', values: [], type: FieldType.string },
        { name: 'traceId', values: [], type: FieldType.string },
      ],
    }),
    toDataFrame({
      name: 'Elastic Logs',
      refId: 'Elastic Query',
      fields: [
        { name: 'Line', values: [] },
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
      type: 'query',
      config: { field: 'traceId', target: { expr: 'target Prometheus query' } },
      provisioned: false,
    },
    // Test multiple correlations attached to the same field
    {
      uid: 'loki-to-elastic',
      label: 'logs to logs',
      source: loki,
      target: elastic,
      type: 'query',
      config: { field: 'traceId', target: { expr: 'target Elastic query' } },
      provisioned: false,
    },
    {
      uid: 'prometheus-to-elastic',
      label: 'metrics to logs',
      source: prometheus,
      target: elastic,
      type: 'query',
      config: { field: 'value', target: { expr: 'target Elastic query' } },
      provisioned: false,
    },
    {
      uid: 'loki-to-loki',
      label: 'logs to logs',
      source: loki,
      target: loki,
      type: 'query',
      config: { field: 'Line', target: { expr: 'target loki query' } },
      provisioned: false,
    },
  ];

  return { testDataFrames, correlations, refIdMap, loki, prometheus, elastic };
}
