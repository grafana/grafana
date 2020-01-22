import { findNewName, nameExits, InitDataSourceSettingDependencies } from './actions';
import { getMockPlugin, getMockPlugins } from '../../plugins/__mocks__/pluginMocks';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { initDataSourceSettingsSucceeded, initDataSourceSettingsFailed } from './reducers';
import { initDataSourceSettings } from '../state/actions';
import { ThunkResult, ThunkDispatch } from 'app/types';
import { GenericDataSourcePlugin } from '../settings/PluginSettings';

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
        importDataSourcePlugin: jest.fn().mockReturnValue({}),
      };
      const state = {
        dataSourceSettings: {},
        datasources: {},
      };
      const dispatchedActions = await thunkTester(state)
        .givenThunk(initDataSourceSettings)
        .whenThunkIsDispatched(256, dependencies);

      expect(dispatchedActions).toEqual([initDataSourceSettingsSucceeded({} as GenericDataSourcePlugin)]);
      expect(dependencies.loadDataSource).toHaveBeenCalledTimes(1);
      expect(dependencies.loadDataSource).toHaveBeenCalledWith(256);
    });
  });
});
