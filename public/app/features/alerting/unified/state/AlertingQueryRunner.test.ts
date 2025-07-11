import { defaultsDeep } from 'lodash';
import { Observable, TimeoutError, lastValueFrom, of, throwError } from 'rxjs';
import { delay, take, timeout } from 'rxjs/operators';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import {
  DataFrame,
  DataFrameJSON,
  DataSourceInstanceSettings,
  Field,
  FieldType,
  LoadingState,
  getDefaultRelativeTimeRange,
  rangeUtil,
} from '@grafana/data';
import { DataSourceSrv, DataSourceWithBackend, FetchResponse } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { DataQuery } from '@grafana/schema';
import { BackendSrv } from 'app/core/services/backend_srv';
import {
  EXTERNAL_VANILLA_ALERTMANAGER_UID,
  mockDataSources,
} from 'app/features/alerting/unified/components/settings/mocks/server';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { AlertingQueryResponse, AlertingQueryRunner } from './AlertingQueryRunner';

setupMswServer();

describe('AlertingQueryRunner', () => {
  it('should successfully map response and return panel data by refId', async () => {
    const response = createFetchResponse<AlertingQueryResponse>({
      results: {
        A: { frames: [createDataFrameJSON([1, 2, 3])] },
        B: { frames: [createDataFrameJSON([5, 6])] },
      },
    });
    setupDataSources(...Object.values(mockDataSources));

    const runner = new AlertingQueryRunner(
      mockBackendSrv({
        fetch: () => of(response),
      })
    );

    const data = runner.get();
    runner.run([createQuery('A'), createQuery('B')], 'B');

    await expect(data.pipe(take(1))).toEmitValuesWith((values) => {
      const [data] = values;
      expect(data).toEqual({
        A: {
          annotations: [],
          state: LoadingState.Done,
          errors: [],
          series: [
            expectDataFrameWithValues({
              time: [1620051612238, 1620051622238, 1620051632238],
              values: [1, 2, 3],
            }),
          ],
          structureRev: 1,
          timeRange: expect.anything(),
          timings: {
            dataProcessingTime: expect.any(Number),
          },
        },
        B: {
          annotations: [],
          state: LoadingState.Done,
          errors: [],
          series: [
            expectDataFrameWithValues({
              time: [1620051612238, 1620051622238],
              values: [5, 6],
            }),
          ],
          structureRev: 1,
          timeRange: expect.anything(),
          timings: {
            dataProcessingTime: expect.any(Number),
          },
        },
      });
    });
  });

  it('should successfully map response with sliding relative time range', async () => {
    const response = createFetchResponse<AlertingQueryResponse>({
      results: {
        A: { frames: [createDataFrameJSON([1, 2, 3])] },
        B: { frames: [createDataFrameJSON([5, 6])] },
      },
    });

    const runner = new AlertingQueryRunner(
      mockBackendSrv({
        fetch: () => of(response),
      }),
      mockDataSourceSrv()
    );

    const data = runner.get();
    runner.run([createQuery('A'), createQuery('B')], 'B');

    await expect(data.pipe(take(1))).toEmitValuesWith((values) => {
      const [data] = values;

      // these test are flakey since the absolute computed "timeRange" can differ from the relative "defaultRelativeTimeRange"
      // so instead we will check if the size of the timeranges match
      const relativeA = rangeUtil.timeRangeToRelative(data.A.timeRange);
      const relativeB = rangeUtil.timeRangeToRelative(data.B.timeRange);
      const defaultRange = getDefaultRelativeTimeRange();

      expect(relativeA.from - defaultRange.from).toEqual(relativeA.to - defaultRange.to);
      expect(relativeB.from - defaultRange.from).toEqual(relativeB.to - defaultRange.to);
    });
  });

  it('should emit loading state if response is slower then 200ms', async () => {
    const response = createFetchResponse<AlertingQueryResponse>({
      results: {
        A: { frames: [createDataFrameJSON([1, 2, 3])] },
        B: { frames: [createDataFrameJSON([5, 6])] },
      },
    });

    const runner = new AlertingQueryRunner(
      mockBackendSrv({
        fetch: () => of(response).pipe(delay(210)),
      })
    );

    const data = runner.get();
    runner.run([createQuery('A'), createQuery('B')], 'B');

    await expect(data.pipe(take(2))).toEmitValuesWith((values) => {
      const [loading, data] = values;

      expect(loading.A.state).toEqual(LoadingState.Loading);
      expect(loading.B.state).toEqual(LoadingState.Loading);

      expect(data).toEqual({
        A: {
          annotations: [],
          state: LoadingState.Done,
          errors: [],
          series: [
            expectDataFrameWithValues({
              time: [1620051612238, 1620051622238, 1620051632238],
              values: [1, 2, 3],
            }),
          ],
          structureRev: 2,
          timeRange: expect.anything(),
          timings: {
            dataProcessingTime: expect.any(Number),
          },
        },
        B: {
          annotations: [],
          state: LoadingState.Done,
          errors: [],
          series: [
            expectDataFrameWithValues({
              time: [1620051612238, 1620051622238],
              values: [5, 6],
            }),
          ],
          structureRev: 2,
          timeRange: expect.anything(),
          timings: {
            dataProcessingTime: expect.any(Number),
          },
        },
      });
    });
  });

  it('should emit error state if fetch request fails', async () => {
    const error = new Error('could not query data');
    const runner = new AlertingQueryRunner(
      mockBackendSrv({
        fetch: () => throwError(error),
      })
    );

    const data = runner.get();
    runner.run([createQuery('A'), createQuery('B')], 'B');

    await expect(data.pipe(take(1))).toEmitValuesWith((values) => {
      const [data] = values;

      expect(data.A.state).toEqual(LoadingState.Error);
      expect(data.A.error).toEqual(error);

      expect(data.B.state).toEqual(LoadingState.Error);
      expect(data.B.error).toEqual(error);
    });
  });

  it('should not push any values if all queries fail filterQuery check', async () => {
    const runner = new AlertingQueryRunner(
      mockBackendSrv({
        fetch: () => throwError(new Error("shouldn't happen")),
      }),
      mockDataSourceSrv({ filterQuery: () => false })
    );

    const data = runner.get();
    runner.run([createQuery('A'), createQuery('B')], 'B');

    await expect(lastValueFrom(data.pipe(timeout(200)))).rejects.toThrow(TimeoutError);
  });

  it('should skip hidden queries and descendant nodes', async () => {
    const results = createFetchResponse<AlertingQueryResponse>({
      results: {
        C: { frames: [createDataFrameJSON([1, 2, 3])] },
      },
    });

    const runner = new AlertingQueryRunner(
      mockBackendSrv({
        fetch: () => of(results),
      }),
      mockDataSourceSrv({ filterQuery: (model: AlertDataQuery) => model.hide !== true })
    );

    const data = runner.get();
    runner.run(
      [
        createQuery('A', {
          model: {
            refId: 'A',
            hide: true,
          },
        }),
        createQuery('B', {
          model: {
            refId: 'B',
            hide: false,
          },
        }),
        createQuery('C', {
          model: {
            refId: 'C',
          },
        }),
      ],
      'B'
    );

    await expect(data.pipe(take(1))).toEmitValuesWith((values) => {
      const [loading, _data] = values;

      expect(loading.A).toBeUndefined();
      expect(loading.B).toBeUndefined();
      expect(loading.C.state).toEqual(LoadingState.Done);
    });
  });
});

type MockBackendSrvConfig = {
  fetch: () => Observable<FetchResponse<AlertingQueryResponse>>;
};

const mockBackendSrv = ({ fetch }: MockBackendSrvConfig): BackendSrv => {
  return {
    fetch,
    resolveCancelerIfExists: jest.fn(),
  } as unknown as BackendSrv;
};

interface MockOpts {
  filterQuery?: (query: DataQuery) => boolean;
}

const mockDataSourceSrv = (opts?: MockOpts) => {
  const ds = new DataSourceWithBackend({} as unknown as DataSourceInstanceSettings);
  ds.filterQuery = opts?.filterQuery;
  return {
    get: () => Promise.resolve(ds),
  } as unknown as DataSourceSrv;
};

const expectDataFrameWithValues = ({ time, values }: { time: number[]; values: number[] }): DataFrame => {
  return {
    fields: [
      {
        config: {},
        entities: {},
        name: 'time',
        state: null,
        type: FieldType.time,
        values: time,
      } as Field,
      {
        config: {},
        entities: {},
        name: 'value',
        state: null,
        type: FieldType.number,
        values: values,
      } as Field,
    ],
    length: values.length,
  };
};

describe('prepareQueries', () => {
  it('should skip node that fail to link', async () => {
    const queries = [
      createQuery('A', {
        model: {
          refId: 'A',
          hide: true, // this node will be omitted
        },
      }),
      createQuery('B', {
        model: {
          refId: 'B',
          hide: false, // this node will _not_ be omitted
        },
      }),
      createExpression('C', {
        model: {
          refId: 'C',
          type: ExpressionQueryType.math,
          expression: '$A', // this node will be omitted because it is a descendant of A (omitted)
        },
      }),
      createExpression('D', {
        model: {
          refId: 'D',
          type: ExpressionQueryType.math,
          expression: '$ZZZ', // this node will be omitted, ref does not exist
        },
      }),
      createExpression('E', {
        model: {
          refId: 'E',
          type: ExpressionQueryType.math,
          expression: '$B', // this node will be omitted, ref does not exist
        },
      }),
      createExpression('F', {
        model: {
          refId: 'F',
          type: ExpressionQueryType.math,
          expression: '$D', // this node will be omitted, because D is broken too
        },
      }),
    ];

    const runner = new AlertingQueryRunner(
      mockBackendSrv({
        fetch: () => of(),
      }),
      mockDataSourceSrv({ filterQuery: (model: AlertDataQuery) => model.hide !== true })
    );

    const queriesToRun = await runner.prepareQueries(queries);

    expect(queriesToRun).toHaveLength(2);
    expect(queriesToRun[0]).toStrictEqual(queries[1]);
    expect(queriesToRun[1]).toStrictEqual(queries[4]);
  });
});

const createDataFrameJSON = (values: number[]): DataFrameJSON => {
  const startTime = 1620051602238;
  const timeValues = values.map((_, index) => startTime + (index + 1) * 10000);

  return {
    schema: {
      fields: [
        { name: 'time', type: FieldType.time },
        { name: 'value', type: FieldType.number },
      ],
    },
    data: {
      values: [timeValues, values],
    },
  };
};

const createQuery = (refId: string, options?: Partial<AlertQuery<DataQuery>>): AlertQuery<DataQuery> => {
  return defaultsDeep(options, {
    refId,
    queryType: '',
    datasourceUid: EXTERNAL_VANILLA_ALERTMANAGER_UID,
    model: { refId },
    relativeTimeRange: getDefaultRelativeTimeRange(),
  });
};

const createExpression = (
  refId: string,
  options?: Partial<AlertQuery<ExpressionQuery>>
): AlertQuery<ExpressionQuery> => {
  return defaultsDeep(options, {
    refId,
    queryType: '',
    datasourceUid: EXTERNAL_VANILLA_ALERTMANAGER_UID,
    model: { refId, datasource: ExpressionDatasourceRef },
    relativeTimeRange: getDefaultRelativeTimeRange(),
  });
};
