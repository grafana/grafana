import { flatten } from 'lodash';
import { from, Observable } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceWithSupplementaryQueriesSupport,
  FieldType,
  LoadingState,
  LogLevel,
  LogsVolumeType,
  MutableDataFrame,
  SupplementaryQueryType,
  toDataFrame,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { MockDataSourceApi } from '../../../../test/mocks/datasource_srv';
import { MockDataQueryRequest, MockQuery } from '../../../../test/mocks/query';
import { ExplorePanelData } from '../../../types';
import { mockExplorePanelData } from '../__mocks__/data';

import { getSupplementaryQueryProvider } from './supplementaryQueries';

class MockDataSourceWithSupplementaryQuerySupport
  extends MockDataSourceApi
  implements DataSourceWithSupplementaryQueriesSupport<DataQuery>
{
  private supplementaryQueriesResults: Record<SupplementaryQueryType, DataFrame[] | undefined> = {
    [SupplementaryQueryType.LogsVolume]: undefined,
    [SupplementaryQueryType.LogsSample]: undefined,
  };

  withSupplementaryQuerySupport(type: SupplementaryQueryType, data: DataFrame[]) {
    this.supplementaryQueriesResults[type] = data;
    return this;
  }

  getDataProvider(
    type: SupplementaryQueryType,
    request: DataQueryRequest<DataQuery>
  ): Observable<DataQueryResponse> | undefined {
    const data = this.supplementaryQueriesResults[type];
    if (data) {
      return from([
        { state: LoadingState.Loading, data: [] },
        { state: LoadingState.Done, data },
      ]);
    }
    return undefined;
  }

  getSupplementaryQuery(type: SupplementaryQueryType, query: DataQuery): DataQuery | undefined {
    return query;
  }

  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return Object.values(SupplementaryQueryType).filter((type) => this.supplementaryQueriesResults[type]);
  }
}

const createSupplementaryQueryResponse = (type: SupplementaryQueryType, id: string) => {
  return [
    toDataFrame({
      refId: `1-${type}-${id}`,
      fields: [{ name: 'value', type: FieldType.string, values: [1] }],
      meta: {
        custom: {
          logsVolumeType: LogsVolumeType.FullRange,
        },
      },
    }),
    toDataFrame({
      refId: `2-${type}-${id}`,
      fields: [{ name: 'value', type: FieldType.string, values: [2] }],
      meta: {
        custom: {
          logsVolumeType: LogsVolumeType.FullRange,
        },
      },
    }),
  ];
};

const mockRow = (refId: string) => {
  return {
    rowIndex: 0,
    entryFieldIndex: 0,
    dataFrame: new MutableDataFrame({ refId, fields: [{ name: 'A', values: [] }] }),
    entry: '',
    hasAnsi: false,
    hasUnescapedContent: false,
    labels: {},
    logLevel: LogLevel.info,
    raw: '',
    timeEpochMs: 0,
    timeEpochNs: '0',
    timeFromNow: '',
    timeLocal: '',
    timeUtc: '',
    uid: '1',
  };
};

const mockExploreDataWithLogs = () =>
  mockExplorePanelData({
    logsResult: {
      rows: [mockRow('0'), mockRow('1')],
      visibleRange: { from: 0, to: 1 },
      bucketSize: 1000,
    },
  });

const datasources: DataSourceApi[] = [
  new MockDataSourceWithSupplementaryQuerySupport('logs-volume-a').withSupplementaryQuerySupport(
    SupplementaryQueryType.LogsVolume,
    createSupplementaryQueryResponse(SupplementaryQueryType.LogsVolume, 'logs-volume-a')
  ),
  new MockDataSourceWithSupplementaryQuerySupport('logs-volume-b').withSupplementaryQuerySupport(
    SupplementaryQueryType.LogsVolume,
    createSupplementaryQueryResponse(SupplementaryQueryType.LogsVolume, 'logs-volume-b')
  ),
  new MockDataSourceWithSupplementaryQuerySupport('logs-sample-a').withSupplementaryQuerySupport(
    SupplementaryQueryType.LogsSample,
    createSupplementaryQueryResponse(SupplementaryQueryType.LogsSample, 'logs-sample-a')
  ),
  new MockDataSourceWithSupplementaryQuerySupport('logs-sample-b').withSupplementaryQuerySupport(
    SupplementaryQueryType.LogsSample,
    createSupplementaryQueryResponse(SupplementaryQueryType.LogsSample, 'logs-sample-b')
  ),
  new MockDataSourceApi('no-data-providers'),
  new MockDataSourceApi('no-data-providers-2'),
  new MockDataSourceApi('mixed').setupMixed(true),
];

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      get: async ({ uid }: { uid: string }) => datasources.find((ds) => ds.name === uid) || undefined,
    };
  },
}));

const setup = async (rootDataSource: string, type: SupplementaryQueryType, targetSources?: string[]) => {
  const rootDataSourceApiMock = await getDataSourceSrv().get({ uid: rootDataSource });

  targetSources = targetSources || [rootDataSource];

  const requestMock = new MockDataQueryRequest({
    targets: targetSources.map((source, i) => new MockQuery(`${i}`, 'a', { uid: source })),
  });
  const explorePanelDataMock: Observable<ExplorePanelData> = mockExploreDataWithLogs();

  return getSupplementaryQueryProvider(rootDataSourceApiMock, type, requestMock, explorePanelDataMock);
};

const assertDataFrom = (type: SupplementaryQueryType, ...datasources: string[]) => {
  return flatten(
    datasources.map((name: string) => {
      return [{ refId: `1-${type}-${name}` }, { refId: `2-${type}-${name}` }];
    })
  );
};

const assertDataFromLogsResults = () => {
  return [{ meta: { custom: { logsVolumeType: LogsVolumeType.Limited } } }];
};

describe('SupplementaryQueries utils', function () {
  describe('Non-mixed data source', function () {
    it('Returns result from the provider', async () => {
      const testProvider = await setup('logs-volume-a', SupplementaryQueryType.LogsVolume);

      await expect(testProvider).toEmitValuesWith((received) => {
        expect(received).toMatchObject([
          { data: [], state: LoadingState.Loading },
          {
            data: assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
            state: LoadingState.Done,
          },
        ]);
      });
    });
    it('Uses fallback for logs volume', async () => {
      const testProvider = await setup('no-data-providers', SupplementaryQueryType.LogsVolume);

      await expect(testProvider).toEmitValuesWith((received) => {
        expect(received).toMatchObject([
          {
            data: assertDataFromLogsResults(),
            state: LoadingState.Done,
          },
        ]);
      });
    });
    it('Returns undefined for logs sample', async () => {
      const testProvider = await setup('no-data-providers', SupplementaryQueryType.LogsSample);
      await expect(testProvider).toBe(undefined);
    });
    it('Creates single fallback result', async () => {
      const testProvider = await setup('no-data-providers', SupplementaryQueryType.LogsVolume, [
        'no-data-providers',
        'no-data-providers-2',
      ]);

      await expect(testProvider).toEmitValuesWith((received) => {
        expect(received).toMatchObject([
          {
            data: assertDataFromLogsResults(),
            state: LoadingState.Done,
          },
          {
            data: [...assertDataFromLogsResults(), ...assertDataFromLogsResults()],
            state: LoadingState.Done,
          },
        ]);
      });
    });
  });

  describe('Mixed data source', function () {
    describe('Logs volume', function () {
      describe('All data sources support full range logs volume', function () {
        it('Merges all data frames into a single response', async () => {
          const testProvider = await setup('mixed', SupplementaryQueryType.LogsVolume, [
            'logs-volume-a',
            'logs-volume-b',
          ]);
          await expect(testProvider).toEmitValuesWith((received) => {
            expect(received).toMatchObject([
              { data: [], state: LoadingState.Loading },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
                state: LoadingState.Done,
              },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a', 'logs-volume-b'),
                state: LoadingState.Done,
              },
            ]);
          });
        });
      });

      describe('All data sources do not support full range logs volume', function () {
        it('Creates single fallback result', async () => {
          const testProvider = await setup('mixed', SupplementaryQueryType.LogsVolume, [
            'no-data-providers',
            'no-data-providers-2',
          ]);

          await expect(testProvider).toEmitValuesWith((received) => {
            expect(received).toMatchObject([
              {
                data: assertDataFromLogsResults(),
                state: LoadingState.Done,
              },
              {
                data: [...assertDataFromLogsResults(), ...assertDataFromLogsResults()],
                state: LoadingState.Done,
              },
            ]);
          });
        });
      });

      describe('Some data sources support full range logs volume, while others do not', function () {
        it('Creates merged result containing full range and limited logs volume', async () => {
          const testProvider = await setup('mixed', SupplementaryQueryType.LogsVolume, [
            'logs-volume-a',
            'no-data-providers',
            'logs-volume-b',
            'no-data-providers-2',
          ]);
          await expect(testProvider).toEmitValuesWith((received) => {
            expect(received).toMatchObject([
              {
                data: [],
                state: LoadingState.Loading,
              },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
                state: LoadingState.Done,
              },
              {
                data: [
                  ...assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
                  ...assertDataFromLogsResults(),
                ],
                state: LoadingState.Done,
              },
              {
                data: [
                  ...assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
                  ...assertDataFromLogsResults(),
                  ...assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-b'),
                ],
                state: LoadingState.Done,
              },
            ]);
          });
        });
      });
    });

    describe('Logs sample', function () {
      describe('All data sources support logs sample', function () {
        it('Merges all responses into single result', async () => {
          const testProvider = await setup('mixed', SupplementaryQueryType.LogsSample, [
            'logs-sample-a',
            'logs-sample-b',
          ]);
          await expect(testProvider).toEmitValuesWith((received) => {
            expect(received).toMatchObject([
              { data: [], state: LoadingState.Loading },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a'),
                state: LoadingState.Done,
              },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a', 'logs-sample-b'),
                state: LoadingState.Done,
              },
            ]);
          });
        });
      });

      describe('All data sources do not support full range logs volume', function () {
        it('Does not provide fallback result', async () => {
          const testProvider = await setup('mixed', SupplementaryQueryType.LogsSample, [
            'no-data-providers',
            'no-data-providers-2',
          ]);
          await expect(testProvider).toEmitValuesWith((received) => {
            expect(received).toMatchObject([{ state: LoadingState.NotStarted, data: [] }]);
          });
        });
      });

      describe('Some data sources support full range logs volume, while others do not', function () {
        it('Returns results only for data sources supporting logs sample', async () => {
          const testProvider = await setup('mixed', SupplementaryQueryType.LogsSample, [
            'logs-sample-a',
            'no-data-providers',
            'logs-sample-b',
            'no-data-providers-2',
          ]);
          await expect(testProvider).toEmitValuesWith((received) => {
            expect(received).toMatchObject([
              { data: [], state: LoadingState.Loading },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a'),
                state: LoadingState.Done,
              },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a', 'logs-sample-b'),
                state: LoadingState.Done,
              },
            ]);
          });
        });
      });
    });
  });
});
