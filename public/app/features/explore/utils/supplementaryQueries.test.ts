import { flatten } from 'lodash';
import { from, Observable, take, toArray } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceWithSupplementaryQueriesSupport,
  FieldType,
  LoadingState,
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
    }),
    toDataFrame({
      refId: `2-${type}-${id}`,
      fields: [{ name: 'value', type: FieldType.string, values: [2] }],
    }),
  ];
};

const mockExploreDataWithLogs = () =>
  mockExplorePanelData({
    logsResult: {
      series: [toDataFrame({ refId: 'logs', fields: [{ name: 'line', type: FieldType.string, values: ['line'] }] })],
      visibleRange: { from: 0, to: 1 },
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
  return [{ refId: 'logs' }];
};

describe('SupplementaryQueries utils', function () {
  describe('Non-mixed data source', function () {
    it('Returns result from the provider', async () => {
      const testProvider = await setup('logs-volume-a', SupplementaryQueryType.LogsVolume);

      await expect(testProvider).toEmitValuesWith((received) => {
        expect(received).toMatchObject([
          { data: [], state: 'Loading' },
          {
            data: assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
            state: 'Done',
          },
        ]);
      });
    });
    it('Uses fallback for logs volume', async () => {
      const testProvider = await setup('no-data-providers', SupplementaryQueryType.LogsVolume);

      await expect(testProvider!.pipe(take(1), toArray())).toEmitValuesWith((received) => {
        expect(received[0]).toMatchObject([
          // No loading state as we don't know if result will contain logs
          {
            data: [{ refId: 'logs' }],
            state: 'Done',
          },
        ]);
      });
    });
    it('Does not use a fallback for logs sample', async () => {
      const testProvider = await setup('no-data-providers', SupplementaryQueryType.LogsSample);
      expect(testProvider).toBeUndefined();
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
              { data: [], state: 'Loading' },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
                state: 'Done',
              },
              { data: assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'), state: 'Loading' },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a', 'logs-volume-b'),
                state: 'Done',
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

          // ExplorePanelData never completes so we limit number of assertions
          await expect(testProvider!.pipe(take(2), toArray())).toEmitValuesWith((received) => {
            expect(received[0]).toMatchObject([
              {
                data: assertDataFromLogsResults(),
                state: 'Done',
              },
              {
                data: assertDataFromLogsResults(),
                state: 'Done',
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
          await expect(testProvider!.pipe(take(6), toArray())).toEmitValuesWith((received) => {
            expect(received[0]).toMatchObject([
              {
                data: [],
                state: 'Loading',
              },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
                state: 'Done',
              },
              {
                data: [
                  ...assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
                  ...assertDataFromLogsResults(),
                ],
                state: 'Done',
              },
              {
                data: [
                  ...assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
                  ...assertDataFromLogsResults(),
                ],
                state: 'Loading',
              },
              {
                data: [
                  ...assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
                  ...assertDataFromLogsResults(),
                  ...assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-b'),
                ],
                state: 'Done',
              },
              {
                data: [
                  ...assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-a'),
                  ...assertDataFrom(SupplementaryQueryType.LogsVolume, 'logs-volume-b'),
                  ...assertDataFromLogsResults(),
                ],
                state: 'Done',
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
              { data: [], state: 'Loading' },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a'),
                state: 'Done',
              },
              { data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a'), state: 'Loading' },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a', 'logs-sample-b'),
                state: 'Done',
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
            expect(received).toMatchObject([
              { state: LoadingState.NotStarted, data: [] },
              { state: LoadingState.NotStarted, data: [] },
            ]);
          });
        });
      });

      describe('Some data sources support full range logs volume, while others do not', function () {
        it('Returns results only for data sources supporting logs sample', async () => {
          const testProvider = await setup('mixed', SupplementaryQueryType.LogsSample, [
            'logs-sample-a',
            'no-data-provider',
            'logs-sample-b',
            'no-data-provider-2',
          ]);
          await expect(testProvider).toEmitValuesWith((received) => {
            expect(received).toMatchObject([
              { data: [], state: 'Loading' },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a'),
                state: 'Done',
              },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a'),
                state: 'Done',
              },
              { data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a'), state: 'Loading' },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a', 'logs-sample-b'),
                state: 'Done',
              },
              {
                data: assertDataFrom(SupplementaryQueryType.LogsSample, 'logs-sample-a', 'logs-sample-b'),
                state: 'Done',
              },
            ]);
          });
        });
      });
    });
  });
});
