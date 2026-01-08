import { flatten } from 'lodash';
import { Observable, from } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataSourceApi,
  DataSourceWithSupplementaryQueriesSupport,
  FieldType,
  LoadingState,
  LogLevel,
  LogsVolumeType,
  MutableDataFrame,
  SupplementaryQueryType,
  SupplementaryQueryOptions,
  toDataFrame,
  DataQueryResponse,
} from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { ExplorePanelData } from 'app/types/explore';

import { MockDataSourceApi } from '../../../../test/mocks/datasource_srv';
import { MockDataQueryRequest, MockQuery } from '../../../../test/mocks/query';
import { mockExplorePanelData } from '../mocks/data';

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

  query(_: DataQueryRequest): Observable<DataQueryResponse> {
    const data =
      this.supplementaryQueriesResults[SupplementaryQueryType.LogsVolume] ||
      this.supplementaryQueriesResults[SupplementaryQueryType.LogsSample] ||
      [];
    return from([{ state: LoadingState.Done, data }]);
  }

  getSupplementaryRequest(
    type: SupplementaryQueryType,
    request: DataQueryRequest<DataQuery>
  ): DataQueryRequest<DataQuery> | undefined {
    const data = this.supplementaryQueriesResults[type];
    if (data) {
      return request;
    }
    return undefined;
  }

  getSupplementaryQuery(_: SupplementaryQueryOptions, query: DataQuery): DataQuery | undefined {
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
];

const setup = (targetSources: string[], type: SupplementaryQueryType) => {
  const requestMock = new MockDataQueryRequest({
    targets: targetSources.map((source, i) => new MockQuery(`${i}`, 'a', { uid: source })),
  });
  const explorePanelDataMock: Observable<ExplorePanelData> = mockExploreDataWithLogs();

  const groupedQueries = targetSources.map((source, i) => {
    const datasource = datasources.find((datasource) => datasource.name === source) || datasources[0];
    return {
      datasource,
      targets: [new MockQuery(`${i}`, 'a', { uid: datasource.name })],
    };
  });

  return getSupplementaryQueryProvider(groupedQueries, type, requestMock, explorePanelDataMock);
};

const assertDataFrom = (type: SupplementaryQueryType, ...datasources: string[]) => {
  return flatten(
    datasources.map((name: string) => {
      return createSupplementaryQueryResponse(type, name);
    })
  );
};

const assertDataFromLogsResults = () => {
  return [{ meta: { custom: { logsVolumeType: LogsVolumeType.Limited } } }];
};

describe('SupplementaryQueries utils', function () {
  describe('Non-mixed data source', function () {
    it('Returns result from the provider', async () => {
      const testProvider = setup(['logs-volume-a'], SupplementaryQueryType.LogsVolume);

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
      const testProvider = setup(['no-data-providers'], SupplementaryQueryType.LogsVolume);

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
      const testProvider = setup(['no-data-providers'], SupplementaryQueryType.LogsSample);
      await expect(testProvider).toBe(undefined);
    });
    it('Creates single fallback result', async () => {
      const testProvider = setup(['no-data-providers', 'no-data-providers-2'], SupplementaryQueryType.LogsVolume);

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
          const testProvider = setup(['logs-volume-a', 'logs-volume-b'], SupplementaryQueryType.LogsVolume);
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
          const testProvider = setup(['no-data-providers', 'no-data-providers-2'], SupplementaryQueryType.LogsVolume);

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
          const testProvider = setup(
            ['logs-volume-a', 'no-data-providers', 'logs-volume-b', 'no-data-providers-2'],
            SupplementaryQueryType.LogsVolume
          );
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
          const testProvider = setup(['logs-sample-a', 'logs-sample-b'], SupplementaryQueryType.LogsSample);
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
          const testProvider = setup(['no-data-providers', 'no-data-providers-2'], SupplementaryQueryType.LogsSample);
          await expect(testProvider).toBeUndefined();
        });
      });

      describe('Some data sources support full range logs volume, while others do not', function () {
        it('Returns results only for data sources supporting logs sample', async () => {
          const testProvider = setup(
            ['logs-sample-a', 'no-data-providers', 'logs-sample-b', 'no-data-providers-2'],
            SupplementaryQueryType.LogsSample
          );
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
