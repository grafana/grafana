import { reducerTester } from 'test/core/redux/reducerTester';
import { dataSourcesReducer, initialState } from './reducers';
import {
  dataSourcesLoaded,
  dataSourceLoaded,
  setDataSourcesSearchQuery,
  setDataSourcesLayoutMode,
  dataSourceTypesLoad,
  dataSourceTypesLoaded,
  setDataSourceTypeSearchQuery,
  dataSourceMetaLoaded,
  setDataSourceName,
  setIsDefault,
} from './actions';
import { getMockDataSources, getMockDataSource } from '../__mocks__/dataSourcesMocks';
import { LayoutModes } from 'app/core/components/LayoutSelector/LayoutSelector';
import { DataSourcesState, Plugin } from 'app/types';
import { PluginMetaInfo, PluginType } from '@grafana/ui';

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
  } as Plugin);

describe('dataSourcesReducer', () => {
  describe('when dataSourcesLoaded is dispatched', () => {
    it('then state should be correct', () => {
      const dataSources = getMockDataSources(0);

      reducerTester()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(dataSourcesLoaded(dataSources))
        .thenStateShouldEqual({ ...initialState, hasFetched: true, dataSources, dataSourcesCount: 1 });
    });
  });

  describe('when dataSourceLoaded is dispatched', () => {
    it('then state should be correct', () => {
      const dataSource = getMockDataSource();

      reducerTester()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(dataSourceLoaded(dataSource))
        .thenStateShouldEqual({ ...initialState, dataSource });
    });
  });

  describe('when setDataSourcesSearchQuery is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(setDataSourcesSearchQuery('some query'))
        .thenStateShouldEqual({ ...initialState, searchQuery: 'some query' });
    });
  });

  describe('when setDataSourcesLayoutMode is dispatched', () => {
    it('then state should be correct', () => {
      const layoutMode: LayoutModes = LayoutModes.Grid;

      reducerTester()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(setDataSourcesLayoutMode(layoutMode))
        .thenStateShouldEqual({ ...initialState, layoutMode: LayoutModes.Grid });
    });
  });

  describe('when dataSourceTypesLoad is dispatched', () => {
    it('then state should be correct', () => {
      const state: DataSourcesState = { ...initialState, dataSourceTypes: [mockPlugin()] };

      reducerTester()
        .givenReducer(dataSourcesReducer, state)
        .whenActionIsDispatched(dataSourceTypesLoad())
        .thenStateShouldEqual({ ...initialState, dataSourceTypes: [], isLoadingDataSources: true });
    });
  });

  describe('when dataSourceTypesLoaded is dispatched', () => {
    it('then state should be correct', () => {
      const dataSourceTypes = [mockPlugin()];
      const state: DataSourcesState = { ...initialState, isLoadingDataSources: true };

      reducerTester()
        .givenReducer(dataSourcesReducer, state)
        .whenActionIsDispatched(dataSourceTypesLoaded(dataSourceTypes))
        .thenStateShouldEqual({ ...initialState, dataSourceTypes, isLoadingDataSources: false });
    });
  });

  describe('when setDataSourceTypeSearchQuery is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(setDataSourceTypeSearchQuery('type search query'))
        .thenStateShouldEqual({ ...initialState, dataSourceTypeSearchQuery: 'type search query' });
    });
  });

  describe('when dataSourceMetaLoaded is dispatched', () => {
    it('then state should be correct', () => {
      const dataSourceMeta = mockPlugin();

      reducerTester()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(dataSourceMetaLoaded(dataSourceMeta))
        .thenStateShouldEqual({ ...initialState, dataSourceMeta });
    });
  });

  describe('when setDataSourceName is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(setDataSourceName('some name'))
        .thenStateShouldEqual({ ...initialState, dataSource: { name: 'some name' } });
    });
  });

  describe('when setIsDefault is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester()
        .givenReducer(dataSourcesReducer, initialState)
        .whenActionIsDispatched(setIsDefault(true))
        .thenStateShouldEqual({ ...initialState, dataSource: { isDefault: true } });
    });
  });
});
