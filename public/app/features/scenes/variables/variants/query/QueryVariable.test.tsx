import {
  DataQueryRequest,
  DataSourceApi,
  DataSourceRef,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  PluginType,
  StandardVariableSupport,
  toDataFrame,
  toUtc,
  VariableRefresh,
  VariableSupportType,
} from '@grafana/data';
import { SceneFlexLayout } from 'app/features/scenes/components';
import { SceneTimeRange } from 'app/features/scenes/core/SceneTimeRange';
import { lastValueFrom, of } from 'rxjs';
import { SceneVariableSet } from '../../sets/SceneVariableSet';
import { QueryRunner, RunnerArgs, setCreateQueryVariableRunnerFactory } from './createQueryVariableRunner';

import { QueryVariable } from './QueryVariable';

const runRequestMock = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    series: [
      toDataFrame({
        fields: [{ name: 'text', type: FieldType.string, values: ['A', 'B', 'C'] }],
      }),
    ],
    timeRange: getDefaultTimeRange(),
  })
);

const fakeDsMock: DataSourceApi = {
  name: 'fake-std',
  type: 'fake-std',
  getRef: () => ({ type: 'fake-std', uid: 'fake-std' }),
  query: () =>
    Promise.resolve({
      data: [],
    }),
  testDatasource: () => Promise.resolve({ status: 'success' }),
  meta: {
    id: 'fake-std',
    type: PluginType.datasource,
    module: 'fake-std',
    baseUrl: '',
    name: 'fake-std',
    info: {
      author: { name: '' },
      description: '',
      links: [],
      logos: { large: '', small: '' },
      updated: '',
      version: '',
      screenshots: [],
    },
  },
  // Standard variable support
  variables: {
    getType: () => VariableSupportType.Standard,
    toDataQuery: (q) => ({ ...q, refId: 'FakeDataSource-refId' }),
  },
  id: 1,
  uid: 'fake-std',
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: (ds: DataSourceRef): Promise<DataSourceApi> => {
      return Promise.resolve(fakeDsMock);
    },
  }),
}));

class FakeQueryRunner implements QueryRunner {
  constructor(private datasource: DataSourceApi, private _runRequest: jest.Mock) {}

  public getTarget(variable: QueryVariable) {
    return (this.datasource.variables as StandardVariableSupport<DataSourceApi>).toDataQuery(variable.state.query);
  }
  public runRequest(args: RunnerArgs, request: DataQueryRequest) {
    return this._runRequest(
      this.datasource,
      request,
      (this.datasource.variables as StandardVariableSupport<DataSourceApi>).query
    );
  }
}

describe('QueryVariable', () => {
  describe('When empty query is provided', () => {
    it('Should default to empty options and empty value', async () => {
      const variable = new QueryVariable({
        name: 'test',
        datasource: { uid: 'fake', type: 'fake' },
        query: '',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toEqual('');
      expect(variable.state.text).toEqual('');
      expect(variable.state.options).toEqual([]);
    });
  });

  describe('When no data source is provided', () => {
    it('Should default to empty options and empty value', async () => {
      const variable = new QueryVariable({
        name: 'test',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toEqual('');
      expect(variable.state.text).toEqual('');
      expect(variable.state.options).toEqual([]);
    });
  });

  describe('Issuing variable query', () => {
    const originalNow = Date.now;
    beforeEach(() => {
      setCreateQueryVariableRunnerFactory(() => new FakeQueryRunner(fakeDsMock, runRequestMock));
    });

    beforeEach(() => {
      Date.now = jest.fn(() => 60000);
    });

    afterEach(() => {
      Date.now = originalNow;
      runRequestMock.mockClear();
    });

    it('Should resolve variable options via provided runner', async () => {
      const variable = new QueryVariable({
        name: 'test',
        datasource: { uid: 'fake-std', type: 'fake-std' },
        query: 'query',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.options).toEqual([
        { label: 'A', value: 'A' },
        { label: 'B', value: 'B' },
        { label: 'C', value: 'C' },
      ]);
    });

    it('Should pass variable scene object via request scoped vars', async () => {
      const variable = new QueryVariable({
        name: 'test',
        datasource: { uid: 'fake-std', type: 'fake-std' },
        query: 'query',
      });

      await lastValueFrom(variable.validateAndUpdate());
      const call = runRequestMock.mock.calls[0];
      expect(call[1].scopedVars.__sceneObject).toEqual({ value: variable, text: '__sceneObject' });
    });

    describe('when refresh on dashboard load set', () => {
      it('Should issue variable query with default time range', async () => {
        const variable = new QueryVariable({
          name: 'test',
          datasource: { uid: 'fake-std', type: 'fake-std' },
          query: 'query',
        });

        await lastValueFrom(variable.validateAndUpdate());

        expect(runRequestMock).toBeCalledTimes(1);
        const call = runRequestMock.mock.calls[0];
        expect(call[1].range).toEqual(getDefaultTimeRange());
      });

      it('Should not issue variable query when the closest time range changes if refresh on dahboard load is set', async () => {
        const timeRange = new SceneTimeRange({ from: 'now-1h', to: 'now' });

        const variable = new QueryVariable({
          name: 'test',
          datasource: { uid: 'fake-std', type: 'fake-std' },
          query: 'query',
          refresh: VariableRefresh.onDashboardLoad,
          $timeRange: timeRange,
        });

        variable.activate();

        await lastValueFrom(variable.validateAndUpdate());

        expect(runRequestMock).toBeCalledTimes(1);
        const call1 = runRequestMock.mock.calls[0];

        // Uses default time range
        expect(call1[1].range.raw).toEqual({
          from: 'now-6h',
          to: 'now',
        });

        timeRange.onTimeRangeChange({
          from: toUtc('2020-01-01'),
          to: toUtc('2020-01-02'),
          raw: { from: toUtc('2020-01-01'), to: toUtc('2020-01-02') },
        });

        await Promise.resolve();

        expect(runRequestMock).toBeCalledTimes(1);
      });
    });

    describe('when refresh on time range change set', () => {
      it('Should issue variable query with closes time range if refresh on time range change set', async () => {
        const variable = new QueryVariable({
          name: 'test',
          datasource: { uid: 'fake-std', type: 'fake-std' },
          query: 'query',
          refresh: VariableRefresh.onTimeRangeChanged,
        });

        // @ts-expect-error
        const scene = new SceneFlexLayout({
          $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
          $variables: new SceneVariableSet({
            variables: [variable],
          }),
          children: [],
        });

        await lastValueFrom(variable.validateAndUpdate());

        expect(runRequestMock).toBeCalledTimes(1);
        const call = runRequestMock.mock.calls[0];

        expect(call[1].range.raw).toEqual({
          from: 'now-1h',
          to: 'now',
        });
      });

      it('Should issue variable query when time range changes if refresh on time range change is set', async () => {
        const timeRange = new SceneTimeRange({ from: 'now-1h', to: 'now' });
        const variable = new QueryVariable({
          name: 'test',
          datasource: { uid: 'fake-std', type: 'fake-std' },
          query: 'query',
          refresh: VariableRefresh.onTimeRangeChanged,
          $timeRange: timeRange,
        });

        variable.activate();

        await lastValueFrom(variable.validateAndUpdate());

        expect(runRequestMock).toBeCalledTimes(1);
        const call1 = runRequestMock.mock.calls[0];
        expect(call1[1].range.raw).toEqual({
          from: 'now-1h',
          to: 'now',
        });

        timeRange.onTimeRangeChange({
          from: toUtc('2020-01-01'),
          to: toUtc('2020-01-02'),
          raw: { from: toUtc('2020-01-01'), to: toUtc('2020-01-02') },
        });

        await Promise.resolve();

        expect(runRequestMock).toBeCalledTimes(2);
        const call2 = runRequestMock.mock.calls[1];
        expect(call2[1].range.raw).toEqual({
          from: '2020-01-01T00:00:00.000Z',
          to: '2020-01-02T00:00:00.000Z',
        });
      });
    });
  });

  describe('When value provided', () => {
    it('should keep valid value', () => {});
  });

  describe('When regex provided', () => {});

  describe('When searchFilter provided', () => {});
});
