import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { PluginsState } from '../../../types';
import {
  initialState,
  pluginDashboardsLoad,
  pluginDashboardsLoaded,
  pluginsLoaded,
  pluginsReducer,
  setPluginsSearchQuery,
} from './reducers';
import { PluginMetaInfo, PluginType } from '@grafana/data';

describe('pluginsReducer', () => {
  describe('when pluginsLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<PluginsState>()
        .givenReducer(pluginsReducer, { ...initialState })
        .whenActionIsDispatched(
          pluginsLoaded([
            {
              id: 'some-id',
              baseUrl: 'some-url',
              module: 'some module',
              name: 'Some Plugin',
              type: PluginType.app,
              info: {} as PluginMetaInfo,
            },
          ])
        )
        .thenStateShouldEqual({
          ...initialState,
          hasFetched: true,
          plugins: [
            {
              baseUrl: 'some-url',
              id: 'some-id',
              info: {} as PluginMetaInfo,
              module: 'some module',
              name: 'Some Plugin',
              type: PluginType.app,
            },
          ],
        });
    });
  });

  describe('when setPluginsSearchQuery is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<PluginsState>()
        .givenReducer(pluginsReducer, { ...initialState })
        .whenActionIsDispatched(setPluginsSearchQuery('A query'))
        .thenStateShouldEqual({
          ...initialState,
          searchQuery: 'A query',
        });
    });
  });

  describe('when pluginDashboardsLoad is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<PluginsState>()
        .givenReducer(pluginsReducer, {
          ...initialState,
          dashboards: [
            {
              dashboardId: 1,
              title: 'Some Dash',
              description: 'Some Desc',
              folderId: 2,
              imported: false,
              importedRevision: 1,
              importedUri: 'some-uri',
              importedUrl: 'some-url',
              path: 'some/path',
              pluginId: 'some-plugin-id',
              removed: false,
              revision: 22,
              slug: 'someSlug',
            },
          ],
        })
        .whenActionIsDispatched(pluginDashboardsLoad())
        .thenStateShouldEqual({
          ...initialState,
          dashboards: [],
          isLoadingPluginDashboards: true,
        });
    });
  });

  describe('when pluginDashboardsLoad is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<PluginsState>()
        .givenReducer(pluginsReducer, { ...initialState, isLoadingPluginDashboards: true })
        .whenActionIsDispatched(
          pluginDashboardsLoaded([
            {
              dashboardId: 1,
              title: 'Some Dash',
              description: 'Some Desc',
              folderId: 2,
              imported: false,
              importedRevision: 1,
              importedUri: 'some-uri',
              importedUrl: 'some-url',
              path: 'some/path',
              pluginId: 'some-plugin-id',
              removed: false,
              revision: 22,
              slug: 'someSlug',
            },
          ])
        )
        .thenStateShouldEqual({
          ...initialState,
          dashboards: [
            {
              dashboardId: 1,
              title: 'Some Dash',
              description: 'Some Desc',
              folderId: 2,
              imported: false,
              importedRevision: 1,
              importedUri: 'some-uri',
              importedUrl: 'some-url',
              path: 'some/path',
              pluginId: 'some-plugin-id',
              removed: false,
              revision: 22,
              slug: 'someSlug',
            },
          ],
          isLoadingPluginDashboards: false,
        });
    });
  });
});
