import { ArrayVector, DataFrameJSON, FieldType, getDefaultRelativeTimeRange, LoadingState } from '@grafana/data';
import { FetchResponse } from '@grafana/runtime';
import { BackendSrv } from 'app/core/services/backend_srv';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';
import { ColdObservable } from 'rxjs/internal/testing/ColdObservable';
import { TestScheduler } from 'rxjs/testing';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { AlertingQueryResponse, AlertingQueryRunner } from './AlertingQueryRunner';

const testScheduler = new TestScheduler((actual, expected) => {
  expect(actual).toEqual(expected);
});

describe('AlertingQueryRunner', () => {
  it('should successfully return panel data by refId', () => {
    testScheduler.run((helpers) => {
      const { expectObservable, cold } = helpers;

      const response = createFetchResponse<AlertingQueryResponse>({
        results: {
          A: { frames: [createDataFrameJSON([1, 2, 3])] },
          B: { frames: [createDataFrameJSON([5, 6])] },
        },
      });

      const runner = new AlertingQueryRunner(
        mockBackendSrv({
          fetch: () => cold('d', { d: response }),
        })
      );

      const data = runner.get();
      runner.run([createQuery('A'), createQuery('B')]);

      expectObservable(data).toBe('e', {
        e: {
          A: {
            annotations: [],
            state: LoadingState.Done,
            series: [
              {
                fields: [
                  {
                    config: {},
                    entities: {},
                    name: 'time',
                    state: null,
                    type: 'time',
                    values: new ArrayVector([1620051612238, 1620051622238, 1620051632238]),
                  },
                  {
                    config: {},
                    entities: {},
                    name: 'value',
                    state: null,
                    type: 'number',
                    values: new ArrayVector([1, 2, 3]),
                  },
                ],
                length: 3,
              },
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
              {
                fields: [
                  {
                    config: {},
                    entities: {},
                    name: 'time',
                    state: null,
                    type: 'time',
                    values: new ArrayVector([1620051612238, 1620051622238]),
                  },
                  {
                    config: {},
                    entities: {},
                    name: 'value',
                    state: null,
                    type: 'number',
                    values: new ArrayVector([5, 6]),
                  },
                ],
                length: 2,
              },
            ],
            structureRev: 1,
            timeRange: expect.anything(),
            timings: {
              dataProcessingTime: expect.any(Number),
            },
          },
        },
      });
    });
  });
});

type MockBackendSrvConfig = {
  fetch: () => ColdObservable<FetchResponse<AlertingQueryResponse>>;
};

const mockBackendSrv = ({ fetch }: MockBackendSrvConfig): BackendSrv => {
  return ({
    fetch,
  } as unknown) as BackendSrv;
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
