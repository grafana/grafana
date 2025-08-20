import { render, RenderResult, waitFor, within } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { PluginType, escapeStringForRegex } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { getCatalogPluginMock, getPluginsStateMock } from '../mocks/mockHelpers';
import { fetchRemotePlugins } from '../state/actions';
import { CatalogPlugin, ReducerState, RequestStatus } from '../types';

import BrowsePage from './Browse';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  const mockedRuntime = { ...original };

  mockedRuntime.config.buildInfo.version = 'v8.1.0';

  return mockedRuntime;
});

const renderBrowse = (
  path = '/plugins',
  plugins: CatalogPlugin[] = [],
  pluginsStateOverride?: ReducerState
): RenderResult => {
  const store = configureStore({ plugins: pluginsStateOverride || getPluginsStateMock(plugins) });
  locationService.push(path);

  return render(
    <TestProvider store={store}>
      <BrowsePage />
    </TestProvider>
  );
};

describe('Browse list of plugins', () => {
  describe('when filtering', () => {
    it('should list all plugins (including core plugins) by default', async () => {
      const { queryByText } = renderBrowse('/plugins', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: false }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isCore: true }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());
      expect(queryByText('Plugin 2')).toBeInTheDocument();

      // Plugins which are not installed should still be listed
      expect(queryByText('Plugin 3')).toBeInTheDocument();

      // Core plugins should still be listed
      expect(queryByText('Plugin 4')).toBeInTheDocument();
    });

    it('should list all plugins (including core plugins) when filtering by all', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&filterByType=all', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isCore: true }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());
      expect(queryByText('Plugin 2')).toBeInTheDocument();
      expect(queryByText('Plugin 3')).toBeInTheDocument();

      // Core plugins should still be listed
      expect(queryByText('Plugin 4')).toBeInTheDocument();
    });

    it('should list installed plugins (including core plugins) when filtering by installed', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=installed', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isCore: true }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());
      expect(queryByText('Plugin 3')).toBeInTheDocument();
      expect(queryByText('Plugin 4')).toBeInTheDocument();

      // Not showing not installed plugins
      expect(queryByText('Plugin 2')).not.toBeInTheDocument();
    });

    it('should list plugins with update when filtering by update', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=has-update', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true, hasUpdate: true }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true, hasUpdate: true }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isCore: true }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());
      expect(queryByText('Plugin 3')).toBeInTheDocument();

      expect(queryByText('Plugin 2')).not.toBeInTheDocument();
      expect(queryByText('Plugin 4')).not.toBeInTheDocument();
    });

    it('should list all plugins (including disabled plugins) when filtering by all', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&filterByType=all', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isDisabled: true }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());

      expect(queryByText('Plugin 2')).toBeInTheDocument();
      expect(queryByText('Plugin 3')).toBeInTheDocument();
      expect(queryByText('Plugin 4')).toBeInTheDocument();
    });

    it('should list installed plugins (including disabled plugins) when filtering by installed', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=installed', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isDisabled: true }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());
      expect(queryByText('Plugin 3')).toBeInTheDocument();
      expect(queryByText('Plugin 4')).toBeInTheDocument();

      // Not showing not installed plugins
      expect(queryByText('Plugin 2')).not.toBeInTheDocument();
    });

    it('should list enterprise plugins when querying for them', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&q=wavefront', [
        getCatalogPluginMock({ id: 'wavefront', name: 'Wavefront', isInstalled: true, isEnterprise: true }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: true, isCore: true }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
      ]);

      await waitFor(() => expect(queryByText('Wavefront')).toBeInTheDocument());

      // Should not show plugins that don't match the query
      expect(queryByText('Plugin 2')).not.toBeInTheDocument();
      expect(queryByText('Plugin 3')).not.toBeInTheDocument();
    });

    it('should list only datasource plugins when filtering by datasource', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&filterByType=datasource', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', type: PluginType.app }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', type: PluginType.datasource }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', type: PluginType.panel }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 2')).toBeInTheDocument());

      // Other plugin types shouldn't be shown
      expect(queryByText('Plugin 1')).not.toBeInTheDocument();
      expect(queryByText('Plugin 3')).not.toBeInTheDocument();
    });

    it('should list only panel plugins when filtering by panel', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&filterByType=panel', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', type: PluginType.app }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', type: PluginType.datasource }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', type: PluginType.panel }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 3')).toBeInTheDocument());

      // Other plugin types shouldn't be shown
      expect(queryByText('Plugin 1')).not.toBeInTheDocument();
      expect(queryByText('Plugin 2')).not.toBeInTheDocument();
    });

    it('should list only app plugins when filtering by app', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&filterByType=app', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', type: PluginType.app }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', type: PluginType.datasource }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', type: PluginType.panel }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());

      // Other plugin types shouldn't be shown
      expect(queryByText('Plugin 2')).not.toBeInTheDocument();
      expect(queryByText('Plugin 3')).not.toBeInTheDocument();
    });

    test('Show request data source and roadmap links', async () => {
      const { queryByText } = renderBrowse('/plugins', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', type: PluginType.datasource }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', type: PluginType.panel }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', type: PluginType.datasource }),
      ]);

      expect(queryByText('Request a new data source')).toBeInTheDocument();
      expect(queryByText('View roadmap')).toBeInTheDocument();
    });
  });

  describe('when searching', () => {
    it('should only list plugins matching search', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&q=matches', [
        getCatalogPluginMock({ id: 'matches-the-search', name: 'Matches the search' }),
        getCatalogPluginMock({
          id: 'plugin-2',
          name: 'Plugin 2',
        }),
        getCatalogPluginMock({
          id: 'plugin-3',
          name: 'Plugin 3',
        }),
      ]);

      await waitFor(() => expect(queryByText('Matches the search')).toBeInTheDocument());

      // Other plugin types shouldn't be shown
      expect(queryByText('Plugin 2')).not.toBeInTheDocument();
      expect(queryByText('Plugin 3')).not.toBeInTheDocument();
    });

    it('should handle escaped regex characters in the search query (e.g. "(" )', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&q=' + escapeStringForRegex('graph (old)'), [
        getCatalogPluginMock({ id: 'graph', name: 'Graph (old)' }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2' }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3' }),
      ]);
      await waitFor(() => expect(queryByText('Graph (old)')).toBeInTheDocument());
      // Other plugin types shouldn't be shown
      expect(queryByText('Plugin 2')).not.toBeInTheDocument();
      expect(queryByText('Plugin 3')).not.toBeInTheDocument();
    });

    it('should be possible to filter plugins by type', async () => {
      const { queryByText } = renderBrowse('/plugins?filterByType=datasource&filterBy=all', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', type: PluginType.app }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', type: PluginType.app }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', type: PluginType.datasource }),
      ]);
      await waitFor(() => expect(queryByText('Plugin 3')).toBeInTheDocument());
      // Other plugin types shouldn't be shown
      expect(queryByText('Plugin 1')).not.toBeInTheDocument();
      expect(queryByText('Plugin 2')).not.toBeInTheDocument();
    });

    it('should be possible to filter plugins both by type and a keyword', async () => {
      const { queryByText } = renderBrowse('/plugins?filterByType=datasource&filterBy=all&q=Foo', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', type: PluginType.app }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', type: PluginType.datasource }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Foo plugin', type: PluginType.datasource }),
      ]);
      await waitFor(() => expect(queryByText('Foo plugin')).toBeInTheDocument());
      // Other plugin types shouldn't be shown
      expect(queryByText('Plugin 1')).not.toBeInTheDocument();
      expect(queryByText('Plugin 2')).not.toBeInTheDocument();
    });

    it('should list all available plugins if the keyword is empty', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&q=', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', type: PluginType.app }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', type: PluginType.panel }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', type: PluginType.datasource }),
      ]);

      // We did not filter for any specific plugin type, so all plugins should be shown
      await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());
      expect(queryByText('Plugin 2')).toBeInTheDocument();
      expect(queryByText('Plugin 3')).toBeInTheDocument();
    });
  });

  describe('when sorting', () => {
    it('should sort plugins by name in ascending alphabetical order', async () => {
      const { findByTestId } = renderBrowse('/plugins?filterBy=all', [
        getCatalogPluginMock({ id: 'wavefront', name: 'Wavefront' }),
        getCatalogPluginMock({ id: 'redis-application', name: 'Redis Application' }),
        getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
        getCatalogPluginMock({ id: 'diagram', name: 'Diagram' }),
        getCatalogPluginMock({ id: 'acesvg', name: 'ACE.SVG' }),
      ]);

      const pluginList = await findByTestId('plugin-list');
      const pluginHeadings = within(pluginList).queryAllByRole('heading');
      expect(pluginHeadings.map((heading) => heading.innerHTML)).toStrictEqual([
        'ACE.SVG',
        'Diagram',
        'Redis Application',
        'Wavefront',
        'Zabbix',
      ]);
    });

    it('should sort plugins by name in descending alphabetical order', async () => {
      const { findByTestId } = renderBrowse('/plugins?filterBy=all&sortBy=nameDesc', [
        getCatalogPluginMock({ id: 'wavefront', name: 'Wavefront' }),
        getCatalogPluginMock({ id: 'redis-application', name: 'Redis Application' }),
        getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
        getCatalogPluginMock({ id: 'diagram', name: 'Diagram' }),
        getCatalogPluginMock({ id: 'acesvg', name: 'ACE.SVG' }),
      ]);

      const pluginList = await findByTestId('plugin-list');
      const pluginHeadings = within(pluginList).queryAllByRole('heading');
      expect(pluginHeadings.map((heading) => heading.innerHTML)).toStrictEqual([
        'Zabbix',
        'Wavefront',
        'Redis Application',
        'Diagram',
        'ACE.SVG',
      ]);
    });

    it('should sort plugins by date in ascending updated order', async () => {
      const { findByTestId } = renderBrowse('/plugins?filterBy=all&sortBy=updated', [
        getCatalogPluginMock({ id: '1', name: 'Wavefront', updatedAt: '2021-04-01T00:00:00.000Z' }),
        getCatalogPluginMock({ id: '2', name: 'Redis Application', updatedAt: '2021-02-01T00:00:00.000Z' }),
        getCatalogPluginMock({ id: '3', name: 'Zabbix', updatedAt: '2021-01-01T00:00:00.000Z' }),
        getCatalogPluginMock({ id: '4', name: 'Diagram', updatedAt: '2021-05-01T00:00:00.000Z' }),
        getCatalogPluginMock({ id: '5', name: 'ACE.SVG', updatedAt: '2021-02-01T00:00:00.000Z' }),
      ]);

      const pluginList = await findByTestId('plugin-list');
      const pluginHeadings = within(pluginList).queryAllByRole('heading');
      expect(pluginHeadings.map((heading) => heading.innerHTML)).toStrictEqual([
        'Diagram',
        'Wavefront',
        'Redis Application',
        'ACE.SVG',
        'Zabbix',
      ]);
    });

    it('should sort plugins by date in ascending published order', async () => {
      const { findByTestId } = renderBrowse('/plugins?filterBy=all&sortBy=published', [
        getCatalogPluginMock({ id: '1', name: 'Wavefront', publishedAt: '2021-04-01T00:00:00.000Z' }),
        getCatalogPluginMock({ id: '2', name: 'Redis Application', publishedAt: '2021-02-01T00:00:00.000Z' }),
        getCatalogPluginMock({ id: '3', name: 'Zabbix', publishedAt: '2021-01-01T00:00:00.000Z' }),
        getCatalogPluginMock({ id: '4', name: 'Diagram', publishedAt: '2021-05-01T00:00:00.000Z' }),
        getCatalogPluginMock({ id: '5', name: 'ACE.SVG', publishedAt: '2021-02-01T00:00:00.000Z' }),
      ]);

      const pluginList = await findByTestId('plugin-list');
      const pluginHeadings = within(pluginList).queryAllByRole('heading');
      expect(pluginHeadings.map((heading) => heading.innerHTML)).toStrictEqual([
        'Diagram',
        'Wavefront',
        'Redis Application',
        'ACE.SVG',
        'Zabbix',
      ]);
    });

    it('should sort plugins by number of downloads in ascending order', async () => {
      const { findByTestId } = renderBrowse('/plugins?filterBy=all&sortBy=downloads', [
        getCatalogPluginMock({ id: '1', name: 'Wavefront', downloads: 30 }),
        getCatalogPluginMock({ id: '2', name: 'Redis Application', downloads: 10 }),
        getCatalogPluginMock({ id: '3', name: 'Zabbix', downloads: 50 }),
        getCatalogPluginMock({ id: '4', name: 'Diagram', downloads: 20 }),
        getCatalogPluginMock({ id: '5', name: 'ACE.SVG', downloads: 40 }),
      ]);

      const pluginList = await findByTestId('plugin-list');
      const pluginHeadings = within(pluginList).queryAllByRole('heading');
      expect(pluginHeadings.map((heading) => heading.innerHTML)).toStrictEqual([
        'Zabbix',
        'ACE.SVG',
        'Wavefront',
        'Diagram',
        'Redis Application',
      ]);
    });
  });

  describe('when GCOM api is not available', () => {
    it('should disable the All / Installed filter', async () => {
      const plugins = [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 2', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 3', isInstalled: true }),
      ];
      const state = getPluginsStateMock(plugins);

      // Mock the store like if the remote plugins request was rejected
      const stateOverride = {
        ...state,
        requests: {
          ...state.requests,
          [fetchRemotePlugins.typePrefix]: {
            status: RequestStatus.Rejected,
          },
        },
      };

      // The radio input for the filters should be disabled
      const { getByRole } = renderBrowse('/plugins', [], stateOverride);
      await waitFor(() => expect(getByRole('radio', { name: 'Installed' })).toBeDisabled());
    });
  });
});
