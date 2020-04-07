import {
  findNewName,
  nameExits,
  InitDataSourceSettingDependencies,
  testDataSource,
  TestDataSourceDependencies,
} from './actions';
import { getMockPlugin, getMockPlugins } from '../../plugins/__mocks__/pluginMocks';
import { thunkTester } from 'test/core/thunk/thunkTester';
import {
  initDataSourceSettingsSucceeded,
  initDataSourceSettingsFailed,
  testDataSourceStarting,
  testDataSourceSucceeded,
  testDataSourceFailed,
} from './reducers';
import { initDataSourceSettings } from '../state/actions';
import { ThunkResult, ThunkDispatch } from 'app/types';
import { GenericDataSourcePlugin } from '../settings/PluginSettings';

const getBackendSrvMock = () =>
  ({
    get: jest.fn().mockReturnValue({
      testDatasource: jest.fn().mockReturnValue({
        status: '',
        message: '',
      }),
    }),
    withNoBackendCache: jest.fn().mockImplementationOnce(cb => cb()),
  } as any);

describe('Name exists', () => {
  const plugins = getMockPlugins(5);

  it('should be true', () => {
    const name = 'pretty cool plugin-1';

    expect(nameExits(plugins, name)).toEqual(true);
  });

  it('should be false', () => {
    const name = 'pretty cool plugin-6';

    expect(nameExits(plugins, name));
  });
});

describe('Find new name', () => {
  it('should create a new name', () => {
    const plugins = getMockPlugins(5);
    const name = 'pretty cool plugin-1';

    expect(findNewName(plugins, name)).toEqual('pretty cool plugin-6');
  });

  it('should create new name without suffix', () => {
    const plugin = getMockPlugin();
    plugin.name = 'prometheus';
    const plugins = [plugin];
    const name = 'prometheus';

    expect(findNewName(plugins, name)).toEqual('prometheus-1');
  });

  it('should handle names that end with -', () => {
    const plugin = getMockPlugin();
    const plugins = [plugin];
    const name = 'pretty cool plugin-';

    expect(findNewName(plugins, name)).toEqual('pretty cool plugin-');
  });
});

describe('initDataSourceSettings', () => {
  describe('when pageId is not a number', () => {
    it('then initDataSourceSettingsFailed should be dispatched', async () => {
      const dispatchedActions = await thunkTester({})
        .givenThunk(initDataSourceSettings)
        .whenThunkIsDispatched('some page');

      expect(dispatchedActions).toEqual([initDataSourceSettingsFailed(new Error('Invalid ID'))]);
    });
  });

  describe('when pageId is a number', () => {
    it('then initDataSourceSettingsSucceeded should be dispatched', async () => {
      const thunkMock = (): ThunkResult<void> => (dispatch: ThunkDispatch, getState) => {};
      const dataSource = { type: 'app' };
      const dataSourceMeta = { id: 'some id' };
      const dependencies: InitDataSourceSettingDependencies = {
        loadDataSource: jest.fn(thunkMock),
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
      const dependencies: InitDataSourceSettingDependencies = {
        loadDataSource: jest.fn().mockImplementation(() => {
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
                status: '',
                message: '',
              }),
            }),
          } as any),
        getBackendSrv: getBackendSrvMock,
      };
      const state = {
        testingStatus: {
          status: '',
          message: '',
        },
      };
      const dispatchedActions = await thunkTester(state)
        .givenThunk(testDataSource)
        .whenThunkIsDispatched('Azure Monitor', dependencies);

      expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceSucceeded(state.testingStatus)]);
    });

    it('then testDataSourceFailed should be dispatched', async () => {
      const dependencies: TestDataSourceDependencies = {
        getDatasourceSrv: () =>
          ({
            get: jest.fn().mockReturnValue({
              testDatasource: jest.fn().mockImplementation(() => {
                throw new Error('Error testing datasource');
              }),
            }),
          } as any),
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
        .whenThunkIsDispatched('Azure Monitor', dependencies);

      expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceFailed(result)]);
    });
  });
});
