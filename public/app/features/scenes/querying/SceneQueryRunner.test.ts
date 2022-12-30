import { map, of } from 'rxjs';

import {
  ArrayVector,
  DataQueryRequest,
  DataSourceApi,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  standardTransformersRegistry,
  toDataFrame,
  dateTime,
} from '@grafana/data';

import { SceneTimeRange } from '../core/SceneTimeRange';

import { SceneQueryRunner } from './SceneQueryRunner';

const getDatasource = () => {
  return {
    getRef: () => ({ uid: 'test' }),
  };
};

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: jest.fn(() => ({
    get: getDatasource,
  })),
}));

const runRequest = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    series: [
      toDataFrame([
        [100, 1],
        [200, 2],
        [300, 3],
      ]),
    ],
    timeRange: getDefaultTimeRange(),
  })
);

let sentRequest: DataQueryRequest | undefined;

jest.mock('app/features/query/state/runRequest', () => ({
  runRequest: (ds: DataSourceApi, request: DataQueryRequest) => {
    sentRequest = request;
    return runRequest(ds, request);
  },
}));

describe('SceneQueryRunner', () => {
  describe('when activated and got no data', () => {
    it('should run queries', async () => {
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        $timeRange: new SceneTimeRange(),
      });

      expect(queryRunner.state.data).toBeUndefined();

      queryRunner.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(queryRunner.state.data?.state).toBe(LoadingState.Done);
      // Default max data points
      expect(sentRequest?.maxDataPoints).toBe(500);
    });
  });

  describe('when activated and maxDataPointsFromWidth set to true', () => {
    it('should run queries', async () => {
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        $timeRange: new SceneTimeRange(),
        maxDataPointsFromWidth: true,
      });

      expect(queryRunner.state.data).toBeUndefined();

      queryRunner.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(queryRunner.state.data?.state).toBeUndefined();

      queryRunner.setContainerWidth(1000);

      expect(queryRunner.state.data?.state).toBeUndefined();

      await new Promise((r) => setTimeout(r, 1));

      expect(queryRunner.state.data?.state).toBe(LoadingState.Done);
    });
  });

  describe('transformations', () => {
    let transformerSpy1 = jest.fn();
    let transformerSpy2 = jest.fn();

    beforeEach(() => {
      standardTransformersRegistry.setInit(() => {
        return [
          {
            id: 'customTransformer1',
            editor: () => null,
            transformation: {
              id: 'customTransformer1',
              name: 'Custom Transformer',
              operator: (options) => (source) => {
                transformerSpy1(options);
                return source.pipe(
                  map((data) => {
                    return data.map((frame) => {
                      return {
                        ...frame,
                        fields: frame.fields.map((field) => {
                          return {
                            ...field,
                            values: new ArrayVector(field.values.toArray().map((v) => v * 2)),
                          };
                        }),
                      };
                    });
                  })
                );
              },
            },
            name: 'Custom Transformer',
          },
          {
            id: 'customTransformer2',
            editor: () => null,
            transformation: {
              id: 'customTransformer2',
              name: 'Custom Transformer2',
              operator: (options) => (source) => {
                transformerSpy2(options);
                return source.pipe(
                  map((data) => {
                    return data.map((frame) => {
                      return {
                        ...frame,
                        fields: frame.fields.map((field) => {
                          return {
                            ...field,
                            values: new ArrayVector(field.values.toArray().map((v) => v * 3)),
                          };
                        }),
                      };
                    });
                  })
                );
              },
            },
            name: 'Custom Transformer 2',
          },
        ];
      });
    });

    it('should apply transformations to query results', async () => {
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        $timeRange: new SceneTimeRange(),
        maxDataPoints: 100,
        transformations: [
          {
            id: 'customTransformer1',
            options: {
              option: 'value1',
            },
          },
          {
            id: 'customTransformer2',
            options: {
              option: 'value2',
            },
          },
        ],
      });

      queryRunner.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(queryRunner.state.data?.state).toBe(LoadingState.Done);
      expect(transformerSpy1).toHaveBeenCalledTimes(1);
      expect(transformerSpy1).toHaveBeenCalledWith({ option: 'value1' });
      expect(transformerSpy2).toHaveBeenCalledTimes(1);
      expect(transformerSpy2).toHaveBeenCalledWith({ option: 'value2' });
      expect(queryRunner.state.data?.series).toHaveLength(1);
      expect(queryRunner.state.data?.series[0].fields).toHaveLength(2);
      expect(queryRunner.state.data?.series[0].fields[0].values.toArray()).toEqual([600, 1200, 1800]);
      expect(queryRunner.state.data?.series[0].fields[1].values.toArray()).toEqual([6, 12, 18]);
    });
  });

  describe('when running queries with time range', () => {
    beforeEach(() => {
      runRequest.mockClear();
    });

    it('should run queries with timeshift applied', async () => {
      const timeRange = { from: '2022-12-30T07:40:56.983Z', to: '2022-12-30T08:40:56.983Z' };
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        $timeRange: new SceneTimeRange(timeRange),
        timeShift: '1h',
      });

      queryRunner.activate();

      await new Promise((r) => setTimeout(r, 1));

      const sentRequest = runRequest.mock.calls[0][1];
      expect(sentRequest.timeInfo).toEqual(' timeshift -1h');
      expect(sentRequest.range.from).toEqual(dateTime(timeRange.from).subtract(1, 'h'));
      expect(sentRequest.range.to).toEqual(dateTime(timeRange.to).subtract(1, 'h'));
    });

    it('should hide time override info if required', async () => {
      const timeRange = { from: '2022-12-29T07:40:56.983Z', to: '2022-12-29T08:40:56.983Z' };
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        $timeRange: new SceneTimeRange(timeRange),
        timeShift: '1h',
        timeFrom: '1h',
        hideTimeOverride: true,
      });

      queryRunner.activate();

      await new Promise((r) => setTimeout(r, 1));

      const sentRequest = runRequest.mock.calls[0][1];
      expect(sentRequest.timeInfo).toEqual('');
    });

    it('should run queries with relative time (timeFrom) applied', async () => {
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        $timeRange: new SceneTimeRange({ from: 'now-3h', to: 'now' }),
        timeFrom: '2h',
      });

      queryRunner.activate();

      await new Promise((r) => setTimeout(r, 1));
      const sentRequest = runRequest.mock.calls[0][1];
      // Overrides timeRange.from to be the value of timeFrom
      expect(dateTime().hour!() - sentRequest.range.from.hour()).toEqual(2);
      // Overrides timeRange.to doesn't change
      expect(dateTime().hour!() - sentRequest.range.to.hour()).toEqual(0);
      expect(sentRequest.timeInfo).toEqual('Last 2 hours');
    });
  });
});
