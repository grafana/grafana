import { reducerTester } from 'test/core/redux/reducerTester';
import {
  dataSourceLoaded,
  dataSourceMetaLoaded,
  dataSourcePluginsLoad,
  dataSourcePluginsLoaded,
  dataSourceSettingsReducer,
  dataSourcesLoaded,
  dataSourcesReducer,
  initDataSourceSettingsFailed,
  initDataSourceSettingsSucceeded,
  initialDataSourceSettingsState,
  initialState,
  setDataSourceName,
  setDataSourcesLayoutMode,
  setDataSourcesSearchQuery,
  setDataSourceTypeSearchQuery,
  setIsDefault,
} from './reducers';
import { getMockDataSource, getMockDataSources } from '../__mocks__/dataSourcesMocks';
import { LayoutModes } from 'app/core/components/LayoutSelector/LayoutSelector';
import { DataSourceSettingsState, DataSourcesState } from 'app/types';
import { PluginMeta, PluginMetaInfo, PluginType } from '@grafana/data';
import { GenericDataSourcePlugin } from '../settings/PluginSettings';

const mockPlugin = () =>
  ({
    defaultNavUrl: 'defaultNavUrl',
    enabled: true,
    hasUpdate: true,
    id: 'id',
    info: {} as PluginMetaInfo,
    latestVersion: 'latestVersion',
    name: 'name',
    pinned: true,
    type: PluginType.datasource,
    module: 'path/to/module',
  } as PluginMeta);

describe('dataSourcesReducer', () => {
  describe('when dataSourcesLoaded is dispatched', () => {
    it('then state should be correct', () => {
      const dataSources = getMockDataSources(0);

      reducerTester<DataSourcesState>()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(dataSourcesLoaded(dataSources))
        .thenStateShouldEqual({ ...initialState, hasFetched: true, dataSources, dataSourcesCount: 1 });
    });
  });

  describe('when dataSourceLoaded is dispatched', () => {
    it('then state should be correct', () => {
      const dataSource = getMockDataSource();

      reducerTester<DataSourcesState>()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(dataSourceLoaded(dataSource))
        .thenStateShouldEqual({ ...initialState, dataSource });
    });
  });

  describe('when setDataSourcesSearchQuery is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<DataSourcesState>()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(setDataSourcesSearchQuery('some query'))
        .thenStateShouldEqual({ ...initialState, searchQuery: 'some query' });
    });
  });

  describe('when setDataSourcesLayoutMode is dispatched', () => {
    it('then state should be correct', () => {
      const layoutMode: LayoutModes = LayoutModes.Grid;

      reducerTester<DataSourcesState>()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(setDataSourcesLayoutMode(layoutMode))
        .thenStateShouldEqual({ ...initialState, layoutMode: LayoutModes.Grid });
    });
  });

  describe('when dataSourcePluginsLoad is dispatched', () => {
    it('then state should be correct', () => {
      const state: DataSourcesState = { ...initialState, plugins: [mockPlugin()] };

      reducerTester<DataSourcesState>()
        .givenReducer(dataSourcesReducer, state)
        .whenActionIsDispatched(dataSourcePluginsLoad())
        .thenStateShouldEqual({ ...initialState, isLoadingDataSources: true });
    });
  });

  describe('when dataSourcePluginsLoaded is dispatched', () => {
    it('then state should be correct', () => {
      const dataSourceTypes = [mockPlugin()];
      const state: DataSourcesState = { ...initialState, isLoadingDataSources: true };

      reducerTester<DataSourcesState>()
        .givenReducer(dataSourcesReducer, state)
        .whenActionIsDispatched(dataSourcePluginsLoaded({ plugins: dataSourceTypes, categories: [] }))
        .thenStateShouldEqual({ ...initialState, plugins: dataSourceTypes, isLoadingDataSources: false });
    });
  });

  describe('when setDataSourceTypeSearchQuery is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<DataSourcesState>()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(setDataSourceTypeSearchQuery('type search query'))
        .thenStateShouldEqual({ ...initialState, dataSourceTypeSearchQuery: 'type search query' });
    });
  });

  describe('when dataSourceMetaLoaded is dispatched', () => {
    it('then state should be correct', () => {
      const dataSourceMeta = mockPlugin();

      reducerTester<DataSourcesState>()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(dataSourceMetaLoaded(dataSourceMeta))
        .thenStateShouldEqual({ ...initialState, dataSourceMeta });
    });
  });

  describe('when setDataSourceName is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<DataSourcesState>()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(setDataSourceName('some name'))
        .thenStateShouldEqual({ ...initialState, dataSource: { name: 'some name' } } as DataSourcesState);
    });
  });

  describe('when setIsDefault is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<DataSourcesState>()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(setIsDefault(true))
        .thenStateShouldEqual({ ...initialState, dataSource: { isDefault: true } } as DataSourcesState);
    });
  });
});

describe('dataSourceSettingsReducer', () => {
  describe('when initDataSourceSettingsSucceeded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<DataSourceSettingsState>()
        .givenReducer(dataSourceSettingsReducer, { ...initialDataSourceSettingsState })
        .whenActionIsDispatched(initDataSourceSettingsSucceeded({} as GenericDataSourcePlugin))
        .thenStateShouldEqual({
          ...initialDataSourceSettingsState,
          plugin: {} as GenericDataSourcePlugin,
          loadError: null,
        });
    });
  });

  describe('when initDataSourceSettingsFailed is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<DataSourceSettingsState>()
        .givenReducer(dataSourceSettingsReducer, {
          ...initialDataSourceSettingsState,
          plugin: {} as GenericDataSourcePlugin,
        })
        .whenActionIsDispatched(initDataSourceSettingsFailed(new Error('Some error')))
        .thenStatePredicateShouldEqual(resultingState => {
          expect(resultingState.plugin).toEqual(null);
          expect(resultingState.loadError).toEqual('Some error');
          return true;
        });
    });
  });
});
