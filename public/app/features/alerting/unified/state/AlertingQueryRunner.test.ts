import { defaultsDeep } from 'lodash';
import { Observable, of, throwError } from 'rxjs';
import { delay, take } from 'rxjs/operators';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import {
  DataFrame,
  DataFrameJSON,
  DataSourceApi,
  Field,
  FieldType,
  getDefaultRelativeTimeRange,
  LoadingState,
  rangeUtil,
} from '@grafana/data';
import { DataSourceSrv, FetchResponse } from '@grafana/runtime';
import { BackendSrv } from 'app/core/services/backend_srv';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { AlertingQueryResponse, AlertingQueryRunner } from './AlertingQueryRunner';

describe('AlertingQueryRunner', () => {
  it('should successfully map response and return panel data by refId', async () => {
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
    runner.run([createQuery('A'), createQuery('B')]);

    await expect(data.pipe(take(1))).toEmitValuesWith((values) => {
      const [data] = values;
      expect(data).toEqual({
        A: {
          annotations: [],
          state: LoadingState.Done,
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
    runner.run([createQuery('A'), createQuery('B')]);

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
      }),
      mockDataSourceSrv()
    );

    const data = runner.get();
    runner.run([createQuery('A'), createQuery('B')]);

    await expect(data.pipe(take(2))).toEmitValuesWith((values) => {
      const [loading, data] = values;

      expect(loading.A.state).toEqual(LoadingState.Loading);
      expect(loading.B.state).toEqual(LoadingState.Loading);

      expect(data).toEqual({
        A: {
          annotations: [],
          state: LoadingState.Done,
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
      }),
      mockDataSourceSrv()
    );

    const data = runner.get();
    runner.run([createQuery('A'), createQuery('B')]);

    await expect(data.pipe(take(1))).toEmitValuesWith((values) => {
      const [data] = values;

      expect(data.A.state).toEqual(LoadingState.Error);
      expect(data.A.error).toEqual(error);

      expect(data.B.state).toEqual(LoadingState.Error);
      expect(data.B.error).toEqual(error);
    });
  });

  it('should not execute if all queries fail filterQuery check', async () => {
    const runner = new AlertingQueryRunner(
      mockBackendSrv({
        fetch: () => throwError(new Error("shouldn't happen")),
      }),
      mockDataSourceSrv({ filterQuery: () => false })
    );

    const data = runner.get();
    runner.run([createQuery('A'), createQuery('B')]);

    await expect(data.pipe(take(1))).toEmitValuesWith((values) => {
      const [data] = values;

      expect(data.A.state).toEqual(LoadingState.Done);
      expect(data.A.series).toHaveLength(0);

      expect(data.B.state).toEqual(LoadingState.Done);
      expect(data.B.series).toHaveLength(0);
    });
  });

  it('should skip hidden queries', async () => {
    const results = createFetchResponse<AlertingQueryResponse>({
      results: {
        B: { frames: [createDataFrameJSON([1, 2, 3])] },
      },
    });

    const runner = new AlertingQueryRunner(
      mockBackendSrv({
        fetch: () => of(results),
      }),
      mockDataSourceSrv({ filterQuery: (model: AlertDataQuery) => model.hide !== true })
    );

    const data = runner.get();
    runner.run([
      createQuery('A', {
        model: {
          refId: 'A',
          hide: true,
        },
      }),
      createQuery('B'),
    ]);

    await expect(data.pipe(take(1))).toEmitValuesWith((values) => {
      const [loading, _data] = values;

      expect(loading.A).toBeUndefined();
      expect(loading.B.state).toEqual(LoadingState.Done);
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

const mockDataSourceSrv = (dsApi?: Partial<DataSourceApi>) => {
  return {
    get: () => Promise.resolve(dsApi ?? {}),
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

const createQuery = (refId: string, options?: Partial<AlertQuery>): AlertQuery => {
  return defaultsDeep(options, {
    refId,
    queryType: '',
    datasourceUid: '',
    model: { refId },
    relativeTimeRange: getDefaultRelativeTimeRange(),
  });
};
