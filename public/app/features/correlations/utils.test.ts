import {
  DataFrame,
  DataFrameType,
  DataSourceInstanceSettings,
  FieldType,
  SupportedTransformationType,
  toDataFrame,
} from '@grafana/data';
import { config, CorrelationData } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema/dist/esm/index';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { ExploreItemState } from 'app/types/explore';

import { EditFormDTO } from './Forms/types';
import { Correlation } from './types';
import { attachCorrelationsToDataFrames, generateDefaultLabel, generatePartialEditSpec } from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({
      name: 'getTest',
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
    attachCorrelationsToDataFrames(testDataFrames, correlations, refIdMap);

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
    attachCorrelationsToDataFrames(testDataFrames, correlations, refIdMap);
    attachCorrelationsToDataFrames(testDataFrames, correlations, refIdMap);

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
    const dataFrameOut = attachCorrelationsToDataFrames([testDataFrame], [correlations[3]], refIdMap);
    expect(dataFrameOut[0].fields[1].config.links).toHaveLength(1);
    config.featureToggles.lokiLogsDataplane = originalDataplaneState;
  });

  it('generates a partial spec with config only when nothing is edited', () => {
    const correlation: Correlation = {
      uid: 'test',
      sourceUID: 'test',
      label: 'test',
      provisioned: false,
      type: 'external',
      config: { field: 'test', target: { url: 'test' } },
    };
    const editForm: EditFormDTO = { ...correlation, label: correlation.label! };
    const partialSpec = generatePartialEditSpec(editForm, correlation);
    expect(partialSpec).toStrictEqual({ config: { field: 'test', target: { url: 'test' } } });
  });

  it('generates a partial spec as expected when things are edited', () => {
    const correlation: Correlation = {
      uid: 'test',
      sourceUID: 'test',
      label: 'test',
      provisioned: false,
      type: 'external',
      config: { field: 'test', target: { url: 'test' } },
    };
    const editForm: EditFormDTO = {
      ...correlation,
      label: 'diffLabel',
      description: 'diffDesc',
      type: 'query',
      config: {
        field: 'diffField',
        target: { diff: 'target' },
        transformations: [
          {
            type: SupportedTransformationType.Logfmt,
            expression: 'diffExp',
            mapValue: 'diffMapValue',
            field: 'diffField',
          },
        ],
      },
    };
    const partialSpec = generatePartialEditSpec(editForm, correlation);
    expect(partialSpec).toStrictEqual({
      label: 'diffLabel',
      description: 'diffDesc',
      type: 'query',
      config: {
        field: 'diffField',
        target: { diff: 'target' },
        transformations: [{ expression: 'diffExp', field: 'diffField', mapValue: 'diffMapValue', type: 'logfmt' }],
      },
    });
  });

  it('generates the expected label from pane datasource when not mixed', async () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { uid: 'testQuery' } }];
    const sourcePane: ExploreItemState = {
      datasourceInstance: { name: 'testA', meta: { mixed: false } },
      queries: queries,
      queryKeys: [],
    } as unknown as ExploreItemState;
    const targetPane: ExploreItemState = {
      datasourceInstance: { name: 'testB', meta: { mixed: false } },
      queries: queries,
      queryKeys: [],
    } as unknown as ExploreItemState;
    const label = await generateDefaultLabel(sourcePane, targetPane);
    expect(label).toBe('testA to testB');
  });

  it('generates the expected label from query datasources when mixed', async () => {
    const queriesA: DataQuery[] = [{ refId: 'A', datasource: { uid: 'testQueryA' } }];
    const queriesB: DataQuery[] = [{ refId: 'B', datasource: { uid: 'testQueryB' } }];
    const sourcePane: ExploreItemState = {
      datasourceInstance: { name: 'testA', meta: { mixed: true } },
      queries: queriesA,
      queryKeys: [],
    } as unknown as ExploreItemState;
    const targetPane: ExploreItemState = {
      datasourceInstance: { name: 'testB', meta: { mixed: false } },
      queries: queriesB,
      queryKeys: [],
    } as unknown as ExploreItemState;
    const label = await generateDefaultLabel(sourcePane, targetPane);
    expect(label).toBe('getTest to testB');
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
