import { render, RenderResult, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { PluginType, escapeStringForRegex } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { configureStore } from 'app/store/configureStore';

import { getCatalogPluginMock, getPluginsStateMock } from '../__mocks__';
import { fetchRemotePlugins } from '../state/actions';
import { PluginAdminRoutes, CatalogPlugin, ReducerState, RequestStatus } from '../types';

import BrowsePage from './Browse';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  const mockedRuntime = { ...original };

  mockedRuntime.config.bootData.user.isGrafanaAdmin = true;
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
  const props = getRouteComponentProps({
    route: { routeName: PluginAdminRoutes.Home } as any,
  });

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <BrowsePage {...props} />
      </Router>
    </Provider>
  );
};

describe('Browse list of plugins', () => {
  describe('when filtering', () => {
    it('should list installed plugins by default', async () => {
      const { queryByText } = renderBrowse('/plugins', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: false }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());
      expect(queryByText('Plugin 1')).toBeInTheDocument();
      expect(queryByText('Plugin 2')).toBeInTheDocument();
      expect(queryByText('Plugin 3')).toBeInTheDocument();

      expect(queryByText('Plugin 4')).toBeNull();
    });

    it('should list all plugins (except core plugins) when filtering by all', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&filterByType=all', [
        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
        getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isCore: true }),
      ]);

      await waitFor(() => expect(queryByText('Plugin 1')).toBeInTheDocument());
      expect(queryByText('Plugin 2')).toBeInTheDocument();
      expect(queryByText('Plugin 3')).toBeInTheDocument();

      // Core plugins should not be listed
      expect(queryByText('Plugin 4')).not.toBeInTheDocument();
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
  });

  describe('when searching', () => {
    it('should only list plugins matching search', async () => {
      const { queryByText } = renderBrowse('/plugins?filterBy=all&q=zabbix', [
        getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2' }),
        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3' }),
      ]);

      await waitFor(() => expect(queryByText('Zabbix')).toBeInTheDocument());

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

  it('should be possible to switch between display modes', async () => {
    const { findByTestId, getByRole, getByTitle, queryByText } = renderBrowse('/plugins?filterBy=all', [
      getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1' }),
      getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2' }),
      getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3' }),
    ]);

    await findByTestId('plugin-list');

    const listOptionTitle = 'Display plugins in list';
    const gridOptionTitle = 'Display plugins in a grid layout';
    const listOption = getByRole('radio', { name: listOptionTitle });
    const listOptionLabel = getByTitle(listOptionTitle);
    const gridOption = getByRole('radio', { name: gridOptionTitle });
    const gridOptionLabel = getByTitle(gridOptionTitle);

    // All options should be visible
    expect(listOptionLabel).toBeVisible();
    expect(gridOptionLabel).toBeVisible();

    // The default display mode should be "grid"
    expect(gridOption).toBeChecked();
    expect(listOption).not.toBeChecked();

    // Switch to "list" view
    await userEvent.click(listOption);
    expect(gridOption).not.toBeChecked();
    expect(listOption).toBeChecked();

    // All plugins are still visible
    expect(queryByText('Plugin 1')).toBeInTheDocument();
    expect(queryByText('Plugin 2')).toBeInTheDocument();
    expect(queryByText('Plugin 3')).toBeInTheDocument();
  });
});
