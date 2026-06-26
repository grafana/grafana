import { thunkTester } from 'test/core/thunk/thunkTester';

import { AppPluginMeta, DataSourceSettings, PluginMetaInfo, PluginType } from '@grafana/data';
import { DataSourceSrv, FetchError } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { ThunkResult, ThunkDispatch } from 'app/types';

import { getMockDataSource } from '../__mocks__';
import * as api from '../api';
import { DATASOURCES_ROUTES } from '../constants';
import { trackDataSourceCreated, trackDataSourceTested } from '../tracking';
import { GenericDataSourcePlugin } from '../types';

import {
  InitDataSourceSettingDependencies,
  testDataSource,
  TestDataSourceDependencies,
  initDataSourceSettings,
  loadDataSource,
  addDataSource,
} from './actions';
import {
  initDataSourceSettingsSucceeded,
  initDataSourceSettingsFailed,
  testDataSourceStarting,
  testDataSourceSucceeded,
  testDataSourceFailed,
  dataSourceLoaded,
} from './reducers';

jest.mock('../api');
jest.mock('app/core/services/backend_srv');
jest.mock('app/core/core', () => ({
  ...jest.requireActual('app/core/core'),
  appEvents: {
    publish: jest.fn(),
  },
}));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn().mockReturnValue({ reload: jest.fn() }),
  getBackendSrv: jest.fn().mockReturnValue({ get: jest.fn() }),
}));
jest.mock('../tracking', () => ({
  trackDataSourceCreated: jest.fn(),
  trackDataSourceTested: jest.fn(),
}));

const getBackendSrvMock = () =>
  ({
    get: jest.fn().mockReturnValue({
      testDatasource: jest.fn().mockReturnValue({
        status: '',
        message: '',
      }),
    }),
    withNoBackendCache: jest.fn().mockImplementationOnce((cb) => cb()),
  }) as unknown as ReturnType<typeof getBackendSrv>;

const failDataSourceTest = async (error: object) => {
  const dependencies: TestDataSourceDependencies = {
    getDatasourceSrv: () =>
      ({
        get: jest.fn().mockReturnValue({
          testDatasource: jest.fn().mockImplementation(() => {
            throw error;
          }),
        }),
      }) as Pick<DataSourceSrv, 'get'>,
    getBackendSrv: getBackendSrvMock,
  };
  const state = {
    testingStatus: {
      message: '',
      status: '',
    },
  };
  const dispatchedActions = await thunkTester(state)
    .givenThunk(testDataSource)
    .whenThunkIsDispatched('Azure Monitor', DATASOURCES_ROUTES.Edit, dependencies);

  return dispatchedActions;
};

describe('loadDataSource()', () => {
  it('should resolve to a data-source if a UID was used for fetching', async () => {
    const dataSourceMock = getMockDataSource();
    const dispatch = jest.fn();
    const getState = jest.fn();

    (api.getDataSourceByIdOrUid as jest.Mock).mockResolvedValueOnce(dataSourceMock);

    const dataSource = await loadDataSource(dataSourceMock.uid)(dispatch, getState, undefined);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(dataSourceLoaded(dataSource));
    expect(dataSource).toBe(dataSourceMock);
  });

  it('should resolve to an empty data-source if an ID (deprecated) was used for fetching', async () => {
    const id = 123;
    const uid = 'uid';
    const dataSourceMock = getMockDataSource({ id, uid });
    const dispatch = jest.fn();
    const getState = jest.fn();

    // @ts-ignore
    delete window.location;
    window.location = {} as Location;

    (api.getDataSourceByIdOrUid as jest.Mock).mockResolvedValueOnce(dataSourceMock);

    // Fetch the datasource by ID
    const dataSource = await loadDataSource(id.toString())(dispatch, getState, undefined);

    expect(dataSource).toEqual({});
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(dataSourceLoaded({} as DataSourceSettings));
  });

  it('should redirect to a URL which uses the UID if an ID (deprecated) was used for fetching', async () => {
    const id = 123;
    const uid = 'uid';
    const dataSourceMock = getMockDataSource({ id, uid });
    const dispatch = jest.fn();
    const getState = jest.fn();

    // @ts-ignore
    delete window.location;
    window.location = {} as Location;

    (api.getDataSourceByIdOrUid as jest.Mock).mockResolvedValueOnce(dataSourceMock);

    // Fetch the datasource by ID
    await loadDataSource(id.toString())(dispatch, getState, undefined);

    expect(window.location.href).toBe(`/datasources/edit/${uid}`);
  });
});

describe('initDataSourceSettings', () => {
  describe('when pageId is missing', () => {
    it('then initDataSourceSettingsFailed should be dispatched', async () => {
      const dispatchedActions = await thunkTester({}).givenThunk(initDataSourceSettings).whenThunkIsDispatched('');

      expect(dispatchedActions).toEqual([initDataSourceSettingsFailed(new Error('Invalid UID'))]);
    });
  });

  describe('when pageId is a valid', () => {
    it('then initDataSourceSettingsSucceeded should be dispatched', async () => {
      const dataSource = { type: 'app' };
      const dataSourceMeta = { id: 'some id' };
      const dependencies: InitDataSourceSettingDependencies = {
        loadDataSource: jest.fn((): ThunkResult<void> => (dispatch: ThunkDispatch, getState) => dataSource) as any,
        loadDataSourceMeta: jest.fn((): ThunkResult<void> => (dispatch: ThunkDispatch, getState) => {}),
        getDataSource: jest.fn().mockReturnValue(dataSource),
        getDataSourceMeta: jest.fn().mockReturnValue(dataSourceMeta),
        importDataSourcePlugin: jest.fn().mockReturnValue({} as GenericDataSourcePlugin),
      };
      const state = {
        dataSourceSettings: {},
        dataSources: {},
      };
      const dispatchedActions = await thunkTester(state)
        .givenThunk(initDataSourceSettings)
        .whenThunkIsDispatched(256, dependencies);

      expect(dispatchedActions).toEqual([initDataSourceSettingsSucceeded({} as GenericDataSourcePlugin)]);
      expect(dependencies.loadDataSource).toHaveBeenCalledTimes(1);
      expect(dependencies.loadDataSource).toHaveBeenCalledWith(256);

      expect(dependencies.loadDataSourceMeta).toHaveBeenCalledTimes(1);
      expect(dependencies.loadDataSourceMeta).toHaveBeenCalledWith(dataSource);

      expect(dependencies.getDataSource).toHaveBeenCalledTimes(1);
      expect(dependencies.getDataSource).toHaveBeenCalledWith({}, 256);

      expect(dependencies.getDataSourceMeta).toHaveBeenCalledTimes(1);
      expect(dependencies.getDataSourceMeta).toHaveBeenCalledWith({}, 'app');

      expect(dependencies.importDataSourcePlugin).toHaveBeenCalledTimes(1);
      expect(dependencies.importDataSourcePlugin).toHaveBeenCalledWith(dataSourceMeta);
    });
  });

  describe('when plugin loading fails', () => {
    it('then initDataSourceSettingsFailed should be dispatched', async () => {
      const dataSource = { type: 'app' };
      const dependencies: InitDataSourceSettingDependencies = {
        loadDataSource: jest.fn((): ThunkResult<void> => (dispatch: ThunkDispatch, getState) => dataSource) as any,
        loadDataSourceMeta: jest.fn().mockImplementation(() => {
          throw new Error('Error loading plugin');
        }),
        getDataSource: jest.fn(),
        getDataSourceMeta: jest.fn(),
        importDataSourcePlugin: jest.fn(),
      };
      const state = {
        dataSourceSettings: {},
        dataSources: {},
      };
      const dispatchedActions = await thunkTester(state)
        .givenThunk(initDataSourceSettings)
        .whenThunkIsDispatched(301, dependencies);

      expect(dispatchedActions).toEqual([initDataSourceSettingsFailed(new Error('Error loading plugin'))]);
      expect(dependencies.loadDataSource).toHaveBeenCalledTimes(1);
      expect(dependencies.loadDataSource).toHaveBeenCalledWith(301);

      expect(dependencies.loadDataSourceMeta).toHaveBeenCalledTimes(1);
      expect(dependencies.loadDataSourceMeta).toHaveBeenCalledWith(dataSource);
    });
  });
});

describe('testDataSource', () => {
  describe('when a datasource is tested', () => {
    it('then testDataSourceStarting and testDataSourceSucceeded should be dispatched', async () => {
      const dependencies: TestDataSourceDependencies = {
        getDatasourceSrv: () =>
          ({
            get: jest.fn().mockReturnValue({
              testDatasource: jest.fn().mockReturnValue({
                status: 'success',
                message: '',
              }),
              type: 'cloudwatch',
              uid: 'CW1234',
            }),
          }) as Pick<DataSourceSrv, 'get'>,
        getBackendSrv: getBackendSrvMock,
      };
      const state = {
        testingStatus: {
          status: 'success',
          message: '',
          details: {},
        },
      };
      const dispatchedActions = await thunkTester(state)
        .givenThunk(testDataSource)
        .whenThunkIsDispatched('CloudWatch', DATASOURCES_ROUTES.Edit, dependencies);

      expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceSucceeded(state.testingStatus)]);
      expect(trackDataSourceTested).toHaveBeenCalledWith({
        plugin_id: 'cloudwatch',
        datasource_uid: 'CW1234',
        grafana_version: '1.0',
        success: true,
        path: '/datasources/edit/CloudWatch',
      });
    });

    it('then testDataSourceFailed should be dispatched', async () => {
      const dependencies: TestDataSourceDependencies = {
        getDatasourceSrv: () =>
          ({
            get: jest.fn().mockReturnValue({
              testDatasource: jest.fn().mockImplementation(() => {
                throw new Error('Error testing datasource');
              }),
              type: 'azure-monitor',
              uid: 'azM0nit0R',
            }),
          }) as Pick<DataSourceSrv, 'get'>,
        getBackendSrv: getBackendSrvMock,
      };
      const result = {
        message: 'Error testing datasource',
      };
      const state = {
        testingStatus: {
          message: '',
          status: '',
        },
      };
      const dispatchedActions = await thunkTester(state)
        .givenThunk(testDataSource)
        .whenThunkIsDispatched('Azure Monitor', DATASOURCES_ROUTES.Edit, dependencies);

      expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceFailed(result)]);
      expect(trackDataSourceTested).toHaveBeenCalledWith({
        plugin_id: 'azure-monitor',
        datasource_uid: 'azM0nit0R',
        grafana_version: '1.0',
        success: false,
        path: '/datasources/edit/Azure Monitor',
      });
    });

    it('then testDataSourceFailed should be dispatched with response error message', async () => {
      const result = {
        message: 'Response error message',
      };
      const error: FetchError = {
        config: {
          url: '',
        },
        data: { message: 'Response error message' },
        status: 400,
        statusText: 'Bad Request',
      };
      const dispatchedActions = await failDataSourceTest(error);
      expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceFailed(result)]);
    });

    it('then testDataSourceFailed should be dispatched with response data message', async () => {
      const result = {
        message: 'Response error message',
      };
      const error: FetchError = {
        config: {
          url: '',
        },
        data: { message: 'Response error message' },
        status: 400,
        statusText: 'Bad Request',
      };
      const dispatchedActions = await failDataSourceTest(error);
      expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceFailed(result)]);
    });

    it('then testDataSourceFailed should be dispatched with response statusText', async () => {
      const result = {
        message: 'HTTP error Bad Request',
      };
      const error: FetchError = {
        config: {
          url: '',
        },
        data: {},
        statusText: 'Bad Request',
        status: 400,
      };
      const dispatchedActions = await failDataSourceTest(error);
      expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceFailed(result)]);
    });

    it('publishes an app event when the test succeeds', async () => {
      const dependencies: TestDataSourceDependencies = {
        getDatasourceSrv: () => ({
          get: jest.fn().mockReturnValue({
            testDatasource: jest.fn().mockReturnValue({
              status: 'success',
              message: '',
            }),
            type: 'cloudwatch',
            uid: 'CW1234',
          }),
        }),
        getBackendSrv: getBackendSrvMock,
      };
      await thunkTester({})
        .givenThunk(testDataSource)
        .whenThunkIsDispatched('CloudWatch', DATASOURCES_ROUTES.Edit, dependencies);
      expect(appEvents.publish).toHaveBeenCalledWith({ type: 'datasource-test-succeeded' });
    });

    it('publishes an app event when the test fails', async () => {
      const error: FetchError = {
        config: {
          url: '',
        },
        data: {},
        statusText: 'Bad Request',
        status: 400,
      };
      await failDataSourceTest(error);
      expect(appEvents.publish).toHaveBeenCalledWith({ type: 'datasource-test-failed' });
    });
  });
});

describe('addDataSource', () => {
  it('it creates a datasource and calls trackDataSourceCreated ', async () => {
    const meta: AppPluginMeta = {
      id: 'azure-monitor',
      module: '',
      baseUrl: 'xxx',
      info: { version: '1.2.3' } as PluginMetaInfo,
      type: PluginType.datasource,
      name: 'test DS',
    };
    const dataSourceMock = { datasource: { uid: 'azure23' }, meta };
    (api.createDataSource as jest.Mock).mockResolvedValueOnce(dataSourceMock);
    (api.getDataSources as jest.Mock).mockResolvedValueOnce([]);

    await thunkTester({}).givenThunk(addDataSource).whenThunkIsDispatched(meta);

    expect(trackDataSourceCreated).toHaveBeenCalledWith({
      plugin_id: 'azure-monitor',
      plugin_version: '1.2.3',
      datasource_uid: 'azure23',
      grafana_version: '1.0',
      path: location.pathname,
    });
  });
});
