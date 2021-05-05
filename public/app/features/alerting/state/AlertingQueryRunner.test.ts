import {
  ArrayVector,
  DataFrame,
  DataFrameJSON,
  Field,
  FieldType,
  getDefaultRelativeTimeRange,
  LoadingState,
  rangeUtil,
} from '@grafana/data';
import { FetchResponse } from '@grafana/runtime';
import { BackendSrv } from 'app/core/services/backend_srv';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';
import { Observable, of, throwError } from 'rxjs';
import { delay, take } from 'rxjs/operators';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
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
      })
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
      })
    );

    const data = runner.get();
    runner.run([createQuery('A'), createQuery('B')]);

    await expect(data.pipe(take(1))).toEmitValuesWith((values) => {
      const [data] = values;
      const relativeA = rangeUtil.timeRangeToRelative(data.A.timeRange);
      const relativeB = rangeUtil.timeRangeToRelative(data.B.timeRange);
      const expected = getDefaultRelativeTimeRange();

      expect(relativeA).toEqual(expected);
      expect(relativeB).toEqual(expected);
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
      })
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
});

type MockBackendSrvConfig = {
  fetch: () => Observable<FetchResponse<AlertingQueryResponse>>;
};

const mockBackendSrv = ({ fetch }: MockBackendSrvConfig): BackendSrv => {
  return ({
    fetch,
    resolveCancelerIfExists: jest.fn(),
  } as unknown) as BackendSrv;
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
        values: new ArrayVector(time),
      } as Field,
      {
        config: {},
        entities: {},
        name: 'value',
        state: null,
        type: FieldType.number,
        values: new ArrayVector(values),
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

const createQuery = (refId: string): GrafanaQuery => {
  return {
    refId,
    queryType: '',
    datasourceUid: '',
    model: { refId },
    relativeTimeRange: getDefaultRelativeTimeRange(),
  };
};
