import { getDefaultNormalizer, render, RenderResult, SelectorMatcherOptions, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import {
  PluginErrorCode,
  PluginSignatureStatus,
  PluginType,
  dateTimeFormatTimeAgo,
  WithAccessControlMetadata,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { configureStore } from 'app/store/configureStore';

import { mockPluginApis, getCatalogPluginMock, getPluginsStateMock, mockUserPermissions } from '../__mocks__';
import * as api from '../api';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { fetchRemotePlugins } from '../state/actions';
import {
  CatalogPlugin,
  CatalogPluginDetails,
  PluginTabIds,
  PluginTabLabels,
  ReducerState,
  RequestStatus,
} from '../types';

import PluginDetailsPage from './PluginDetails';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  const mockedRuntime = { ...original };
  mockedRuntime.config.buildInfo.version = 'v8.1.0';
  return mockedRuntime;
});

jest.mock('../hooks/usePluginConfig.tsx', () => ({
  usePluginConfig: jest.fn(() => ({
    value: {
      meta: {},
    },
  })),
}));

jest.mock('../helpers.ts', () => ({
  ...jest.requireActual('../helpers.ts'),
  updatePanels: jest.fn(),
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasAccess: (action: string, fallBack: boolean) => true,
    hasAccessInMetadata: (action: string, object: WithAccessControlMetadata, fallBack: boolean) => true,
  },
}));

const renderPluginDetails = (
  pluginOverride: Partial<CatalogPlugin>,
  {
    pageId,
    pluginsStateOverride,
  }: {
    pageId?: PluginTabIds;
    pluginsStateOverride?: ReducerState;
  } = {}
): RenderResult => {
  const plugin = getCatalogPluginMock(pluginOverride);
  const { id } = plugin;
  const props = getRouteComponentProps({
    match: { params: { pluginId: id }, isExact: true, url: '', path: '' },
    queryParams: { page: pageId },
    location: {
      hash: '',
      pathname: `/plugins/${id}`,
      search: pageId ? `?page=${pageId}` : '',
      state: undefined,
    },
  });
  const store = configureStore({
    plugins: pluginsStateOverride || getPluginsStateMock([plugin]),
  });

  return render(
    <MemoryRouter>
      <Provider store={store}>
        <PluginDetailsPage {...props} />
      </Provider>
    </MemoryRouter>
  );
};

describe('Plugin details page', () => {
  const id = 'my-plugin';
  const originalWindowLocation = window.location;
  let dateNow: jest.SpyInstance<number, []>;

  beforeAll(() => {
    dateNow = jest.spyOn(Date, 'now').mockImplementation(() => 1609470000000); // 2021-01-01 04:00:00

    // Enabling / disabling the plugin is currently reloading the page to propagate the changes
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: jest.fn() },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    config.pluginAdminExternalManageEnabled = false;
    config.licenseInfo.enabledFeatures = {};
  });

  afterAll(() => {
    dateNow.mockRestore();
    Object.defineProperty(window, 'location', { configurable: true, value: originalWindowLocation });
  });

  describe('viewed as user with grafana admin permissions', () => {
    beforeAll(() => {
      mockUserPermissions({
        isAdmin: true,
        isDataSourceEditor: true,
        isOrgAdmin: true,
      });
    });

    // We are doing this very basic test to see if the API fetching and data-munging is working correctly from a high-level.
    it('(SMOKE TEST) - should fetch and merge the remote and local plugin API responses correctly ', async () => {
      const id = 'smoke-test-plugin';

      mockPluginApis({
        remote: { slug: id },
        local: { id },
      });

      const props = getRouteComponentProps({
        match: { params: { pluginId: id }, isExact: true, url: '', path: '' },
        queryParams: {},
        location: {
          hash: '',
          pathname: `/plugins/${id}`,
          search: '',
          state: undefined,
        },
      });
      const store = configureStore();
      const { queryByText } = render(
        <MemoryRouter>
          <Provider store={store}>
            <PluginDetailsPage {...props} />
          </Provider>
          ,
        </MemoryRouter>
      );

      await waitFor(() => expect(queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument());
    });

    it('should display an overview (plugin readme) by default', async () => {
      const { queryByText } = renderPluginDetails({ id });

      await waitFor(() => expect(queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument());
    });

    it('should display an app config page by default for installed app plugins', async () => {
      const name = 'Akumuli';

      // @ts-ignore
      usePluginConfig.mockReturnValue({
        value: {
          meta: {
            type: PluginType.app,
            enabled: false,
            pinned: false,
            jsonData: {},
          },
          configPages: [
            {
              title: 'Config',
              icon: 'cog',
              id: 'configPage',
              body: function ConfigPage() {
                return <div>Custom Config Page!</div>;
              },
            },
          ],
        },
      });

      const { queryByText } = renderPluginDetails({
        name,
        isInstalled: true,
        type: PluginType.app,
      });

      await waitFor(() => expect(queryByText(/custom config page/i)).toBeInTheDocument());
    });

    it('should display the number of downloads in the header', async () => {
      // depending on what locale you have the Intl.NumberFormat will return a format that contains
      // whitespaces. In that case we don't want testing library to remove whitespaces.
      const downloads = 24324;
      const options: SelectorMatcherOptions = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };
      const expected = new Intl.NumberFormat().format(downloads);

      const { queryByText } = renderPluginDetails({ id, downloads });
      await waitFor(() => expect(queryByText(expected, options)).toBeInTheDocument());
    });

    it('should display the installed version if a plugin is installed', async () => {
      const installedVersion = '1.3.443';
      const { queryByText } = renderPluginDetails({ id, installedVersion });

      await waitFor(() => expect(queryByText(installedVersion)).toBeInTheDocument());
    });

    it('should display the latest compatible version in the header if a plugin is not installed', async () => {
      const details: CatalogPluginDetails = {
        links: [],
        versions: [
          { version: '1.3.0', createdAt: '', isCompatible: false, grafanaDependency: '>=9.0.0' },
          { version: '1.2.0', createdAt: '', isCompatible: false, grafanaDependency: '>=8.3.0' },
          { version: '1.1.1', createdAt: '', isCompatible: true, grafanaDependency: '>=8.0.0' },
          { version: '1.1.0', createdAt: '', isCompatible: true, grafanaDependency: '>=8.0.0' },
          { version: '1.0.0', createdAt: '', isCompatible: true, grafanaDependency: '>=7.0.0' },
        ],
      };

      const { queryByText } = renderPluginDetails({ id, details });
      await waitFor(() => expect(queryByText('1.1.1')).toBeInTheDocument());
      await waitFor(() => expect(queryByText(/>=8.0.0/i)).toBeInTheDocument());
    });

    it('should display description in the header', async () => {
      const description = 'This is my description';
      const { queryByText } = renderPluginDetails({ id, description });

      await waitFor(() => expect(queryByText(description)).toBeInTheDocument());
    });

    it('should display a "Signed" badge if the plugin signature is verified', async () => {
      const { queryByText } = renderPluginDetails({ id, signature: PluginSignatureStatus.valid });

      await waitFor(() => expect(queryByText('Signed')).toBeInTheDocument());
    });

    it('should display a "Missing signature" badge if the plugin signature is missing', async () => {
      const { queryByText } = renderPluginDetails({ id, signature: PluginSignatureStatus.missing });

      await waitFor(() => expect(queryByText('Missing signature')).toBeInTheDocument());
    });

    it('should display a "Modified signature" badge if the plugin signature is modified', async () => {
      const { queryByText } = renderPluginDetails({ id, signature: PluginSignatureStatus.modified });

      await waitFor(() => expect(queryByText('Modified signature')).toBeInTheDocument());
    });

    it('should display a "Invalid signature" badge if the plugin signature is invalid', async () => {
      const { queryByText } = renderPluginDetails({ id, signature: PluginSignatureStatus.invalid });

      await waitFor(() => expect(queryByText('Invalid signature')).toBeInTheDocument());
    });

    it('should display version history if the plugin is published', async () => {
      const versions = [
        {
          version: '1.2.0',
          createdAt: '2018-04-06T20:23:41.000Z',
          isCompatible: false,
          grafanaDependency: '>=8.3.0',
        },
        {
          version: '1.1.0',
          createdAt: '2017-04-06T20:23:41.000Z',
          isCompatible: true,
          grafanaDependency: '>=8.0.0',
        },
        {
          version: '1.0.0',
          createdAt: '2016-04-06T20:23:41.000Z',
          isCompatible: true,
          grafanaDependency: '>=7.0.0',
        },
      ];

      const { queryByText, getByRole } = renderPluginDetails(
        {
          id,
          details: {
            links: [],
            versions,
          },
        },
        { pageId: PluginTabIds.VERSIONS }
      );

      // Check if version information is available
      await waitFor(() => expect(queryByText(/version history/i)).toBeInTheDocument());

      // Check the column headers
      expect(getByRole('columnheader', { name: /version/i })).toBeInTheDocument();
      expect(getByRole('columnheader', { name: /last updated/i })).toBeInTheDocument();

      // Check the data
      for (const version of versions) {
        expect(getByRole('cell', { name: new RegExp(version.version, 'i') })).toBeInTheDocument();
        expect(
          getByRole('cell', { name: new RegExp(dateTimeFormatTimeAgo(version.createdAt), 'i') })
        ).toBeInTheDocument();

        // Check the latest compatible version
        expect(queryByText('1.1.0 (latest compatible version)')).toBeInTheDocument();
      }
    });

    it("should display an install button for a plugin that isn't installed", async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: false });

      await waitFor(() => expect(queryByRole('button', { name: /^install/i })).toBeInTheDocument());
      // Does not display "uninstall" button
      expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
    });

    it('should display an uninstall button for an already installed plugin', async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: true });

      await waitFor(() => expect(queryByRole('button', { name: /uninstall/i })).toBeInTheDocument());
      // Does not display "install" button
      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });

    it('should display update and uninstall buttons for a plugin with update', async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: true, hasUpdate: true });

      // Displays an "update" button
      await waitFor(() => expect(queryByRole('button', { name: /update/i })).toBeInTheDocument());
      expect(queryByRole('button', { name: /uninstall/i })).toBeInTheDocument();

      // Does not display "install" button
      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });

    it('should display an install button for enterprise plugins if license is valid', async () => {
      config.licenseInfo.enabledFeatures = { 'enterprise.plugins': true };

      const { queryByRole } = renderPluginDetails({ id, isInstalled: false, isEnterprise: true });

      await waitFor(() => expect(queryByRole('button', { name: /install/i })).toBeInTheDocument());
    });

    it('should not display install button for enterprise plugins if license is invalid', async () => {
      config.licenseInfo.enabledFeatures = {};

      const { queryByRole, queryByText } = renderPluginDetails({ id, isInstalled: true, isEnterprise: true });

      await waitFor(() => expect(queryByRole('button', { name: /install/i })).not.toBeInTheDocument());
      expect(queryByText(/no valid Grafana Enterprise license detected/i)).toBeInTheDocument();
      expect(queryByRole('link', { name: /learn more/i })).toBeInTheDocument();
    });

    it('should not display install / uninstall buttons for core plugins', async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: true, isCore: true });

      await waitFor(() => expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument());
      await waitFor(() => expect(queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument());
    });

    it('should not display install / uninstall buttons for disabled plugins', async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: true, isDisabled: true });

      await waitFor(() => expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument());
      await waitFor(() => expect(queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument());
    });

    it('should not display install / uninstall buttons for renderer plugins', async () => {
      const { queryByRole } = renderPluginDetails({ id, type: PluginType.renderer });

      await waitFor(() => expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument());
      await waitFor(() => expect(queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument());
    });

    it('should display install link with `config.pluginAdminExternalManageEnabled` set to true', async () => {
      config.pluginAdminExternalManageEnabled = true;

      const { queryByRole } = renderPluginDetails({ id, isInstalled: false });

      await waitFor(() => expect(queryByRole('link', { name: /install via grafana.com/i })).toBeInTheDocument());
    });

    it('should display uninstall link for an installed plugin with `config.pluginAdminExternalManageEnabled` set to true', async () => {
      config.pluginAdminExternalManageEnabled = true;

      const { queryByRole } = renderPluginDetails({ id, isInstalled: true });

      await waitFor(() => expect(queryByRole('link', { name: /uninstall via grafana.com/i })).toBeInTheDocument());
    });

    it('should display update and uninstall links for a plugin with an available update and `config.pluginAdminExternalManageEnabled` set to true', async () => {
      config.pluginAdminExternalManageEnabled = true;

      const { queryByRole } = renderPluginDetails({ id, isInstalled: true, hasUpdate: true });

      await waitFor(() => expect(queryByRole('link', { name: /update via grafana.com/i })).toBeInTheDocument());
      expect(queryByRole('link', { name: /uninstall via grafana.com/i })).toBeInTheDocument();
    });

    it('should display alert with information about why the plugin is disabled', async () => {
      const { queryByLabelText } = renderPluginDetails({
        id,
        isInstalled: true,
        isDisabled: true,
        error: PluginErrorCode.modifiedSignature,
      });

      await waitFor(() => expect(queryByLabelText(selectors.pages.PluginPage.disabledInfo)).toBeInTheDocument());
    });

    it('should display grafana dependencies for a plugin if they are available', async () => {
      const { queryByText } = renderPluginDetails({
        id,
        details: {
          pluginDependencies: [],
          grafanaDependency: '>=8.0.0',
          links: [],
        },
      });

      // Wait for the dependencies part to be loaded
      await waitFor(() => expect(queryByText(/dependencies:/i)).toBeInTheDocument());

      expect(queryByText('Grafana >=8.0.0')).toBeInTheDocument();
    });

    it('should show a confirm modal when trying to uninstall a plugin', async () => {
      // @ts-ignore
      api.uninstallPlugin = jest.fn();

      const { queryByText, getByRole } = renderPluginDetails({
        id,
        name: 'Akumuli',
        isInstalled: true,
        details: {
          pluginDependencies: [],
          grafanaDependency: '>=8.0.0',
          links: [],
          versions: [
            {
              version: '1.0.0',
              createdAt: '',
              isCompatible: true,
              grafanaDependency: '>=8.0.0',
            },
          ],
        },
      });

      // Wait for the install controls to be loaded
      await waitFor(() => expect(queryByText(PluginTabLabels.OVERVIEW)).toBeInTheDocument());

      // Open the confirmation modal
      await userEvent.click(getByRole('button', { name: /uninstall/i }));

      expect(queryByText('Uninstall Akumuli')).toBeInTheDocument();
      expect(queryByText('Are you sure you want to uninstall this plugin?')).toBeInTheDocument();
      expect(api.uninstallPlugin).toHaveBeenCalledTimes(0);

      // Confirm the uninstall
      await userEvent.click(getByRole('button', { name: /confirm/i }));
      expect(api.uninstallPlugin).toHaveBeenCalledTimes(1);
      expect(api.uninstallPlugin).toHaveBeenCalledWith(id);

      // Check if the modal disappeared
      expect(queryByText('Uninstall Akumuli')).not.toBeInTheDocument();
    });

    it('should not display the install / uninstall / update buttons if the GCOM api is not available', async () => {
      let rendered: RenderResult;
      const plugin = getCatalogPluginMock({ id });
      const state = getPluginsStateMock([plugin]);

      // Mock the store like if the remote plugins request was rejected
      const pluginsStateOverride = {
        ...state,
        requests: {
          ...state.requests,
          [fetchRemotePlugins.typePrefix]: {
            status: RequestStatus.Rejected,
          },
        },
      };

      // Does not show an Install button
      rendered = renderPluginDetails({ id }, { pluginsStateOverride });
      await waitFor(() => expect(rendered.queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument());
      rendered.unmount();

      // Does not show a Uninstall button
      rendered = renderPluginDetails({ id, isInstalled: true }, { pluginsStateOverride });
      await waitFor(() => expect(rendered.queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument());
      rendered.unmount();

      // Does not show an Update button
      rendered = renderPluginDetails({ id, isInstalled: true, hasUpdate: true }, { pluginsStateOverride });
      await waitFor(() => expect(rendered.queryByRole('button', { name: /update/i })).not.toBeInTheDocument());

      // Shows a message to the user
      // TODO<Import these texts from a single source of truth instead of having them defined in multiple places>
      const message = 'The install controls have been disabled because the Grafana server cannot access grafana.com.';
      expect(rendered.getByText(message)).toBeInTheDocument();
    });

    it('should not display the install / uninstall / update buttons if `pluginAdminEnabled` flag is set to FALSE in the Grafana config', async () => {
      let rendered: RenderResult;

      // Disable the install controls for the plugins catalog
      config.pluginAdminEnabled = false;

      // Should not show an "Install" button
      rendered = renderPluginDetails({ id, isInstalled: false });
      await waitFor(() => expect(rendered.queryByRole('button', { name: /^install/i })).not.toBeInTheDocument());

      // Should not show an "Uninstall" button
      rendered = renderPluginDetails({ id, isInstalled: true });
      await waitFor(() => expect(rendered.queryByRole('button', { name: /^uninstall/i })).not.toBeInTheDocument());

      // Should not show an "Update" button
      rendered = renderPluginDetails({ id, isInstalled: true, hasUpdate: true });
      await waitFor(() => expect(rendered.queryByRole('button', { name: /^update/i })).not.toBeInTheDocument());
    });

    it('should display a "Create" button as a post installation step for installed data source plugins', async () => {
      const name = 'Akumuli';
      const { queryByText } = renderPluginDetails({
        name,
        isInstalled: true,
        type: PluginType.datasource,
      });

      await waitFor(() => queryByText('Uninstall'));
      expect(queryByText(`Create a ${name} data source`)).toBeInTheDocument();
    });

    it('should not display a "Create" button as a post installation step for disabled data source plugins', async () => {
      const name = 'Akumuli';
      const { queryByText } = renderPluginDetails({
        name,
        isInstalled: true,
        isDisabled: true,
        type: PluginType.datasource,
      });

      await waitFor(() => queryByText('Uninstall'));
      expect(queryByText(`Create a ${name} data source`)).toBeNull();
    });

    it('should not display post installation step for panel plugins', async () => {
      const name = 'Akumuli';
      const { queryByText } = renderPluginDetails({
        name,
        isInstalled: true,
        type: PluginType.panel,
      });

      await waitFor(() => queryByText('Uninstall'));
      expect(queryByText(`Create a ${name} data source`)).toBeNull();
    });

    it('should display an enable button for app plugins that are not enabled as a post installation step', async () => {
      const name = 'Akumuli';

      // @ts-ignore
      usePluginConfig.mockReturnValue({
        value: {
          meta: {
            enabled: false,
            pinned: false,
            jsonData: {},
          },
        },
      });

      const { queryByText, queryByRole } = renderPluginDetails({
        name,
        isInstalled: true,
        type: PluginType.app,
      });

      await waitFor(() => queryByText('Uninstall'));

      expect(queryByRole('button', { name: /enable/i })).toBeInTheDocument();
      expect(queryByRole('button', { name: /disable/i })).not.toBeInTheDocument();
    });

    it('should display a disable button for app plugins that are enabled as a post installation step', async () => {
      const name = 'Akumuli';

      // @ts-ignore
      usePluginConfig.mockReturnValue({
        value: {
          meta: {
            enabled: true,
            pinned: false,
            jsonData: {},
          },
        },
      });

      const { queryByText, queryByRole } = renderPluginDetails({
        name,
        isInstalled: true,
        type: PluginType.app,
      });

      await waitFor(() => queryByText('Uninstall'));

      expect(queryByRole('button', { name: /disable/i })).toBeInTheDocument();
      expect(queryByRole('button', { name: /enable/i })).not.toBeInTheDocument();
    });

    it('should be possible to enable an app plugin', async () => {
      const id = 'akumuli-datasource';
      const name = 'Akumuli';

      // @ts-ignore
      api.updatePluginSettings = jest.fn();

      // @ts-ignore
      usePluginConfig.mockReturnValue({
        value: {
          meta: {
            enabled: false,
            pinned: false,
            jsonData: {},
          },
        },
      });

      const { queryByText, getByRole } = renderPluginDetails({
        id,
        name,
        isInstalled: true,
        type: PluginType.app,
      });

      // Wait for the header to be loaded
      await waitFor(() => queryByText('Uninstall'));

      // Click on "Enable"
      await userEvent.click(getByRole('button', { name: /enable/i }));

      // Check if the API request was initiated
      expect(api.updatePluginSettings).toHaveBeenCalledTimes(1);
      expect(api.updatePluginSettings).toHaveBeenCalledWith(id, {
        enabled: true,
        pinned: true,
        jsonData: {},
      });
    });

    it('should be possible to disable an app plugin', async () => {
      const id = 'akumuli-datasource';
      const name = 'Akumuli';

      // @ts-ignore
      api.updatePluginSettings = jest.fn();

      // @ts-ignore
      usePluginConfig.mockReturnValue({
        value: {
          meta: {
            enabled: true,
            pinned: true,
            jsonData: {},
          },
        },
      });

      const { queryByText, getByRole } = renderPluginDetails({
        id,
        name,
        isInstalled: true,
        type: PluginType.app,
      });

      // Wait for the header to be loaded
      await waitFor(() => queryByText('Uninstall'));

      // Click on "Disable"
      await userEvent.click(getByRole('button', { name: /disable/i }));

      // Check if the API request was initiated
      expect(api.updatePluginSettings).toHaveBeenCalledTimes(1);
      expect(api.updatePluginSettings).toHaveBeenCalledWith(id, {
        enabled: false,
        pinned: false,
        jsonData: {},
      });
    });

    it('should not display versions tab for plugins not published to gcom', async () => {
      const { queryByText } = renderPluginDetails({
        name: 'Akumuli',
        isInstalled: true,
        type: PluginType.app,
        isPublished: false,
      });

      await waitFor(() => expect(queryByText(PluginTabLabels.OVERVIEW)).toBeInTheDocument());

      expect(queryByText(PluginTabLabels.VERSIONS)).toBeNull();
    });

    it('should not display update for plugins not published to gcom', async () => {
      const { queryByText, queryByRole } = renderPluginDetails({
        name: 'Akumuli',
        isInstalled: true,
        hasUpdate: true,
        type: PluginType.app,
        isPublished: false,
      });

      await waitFor(() => expect(queryByText(PluginTabLabels.OVERVIEW)).toBeInTheDocument());

      expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
    });

    it('should not display install for plugins not published to gcom', async () => {
      const { queryByText, queryByRole } = renderPluginDetails({
        name: 'Akumuli',
        isInstalled: false,
        hasUpdate: false,
        type: PluginType.app,
        isPublished: false,
      });

      await waitFor(() => expect(queryByText(PluginTabLabels.OVERVIEW)).toBeInTheDocument());

      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });

    it('should not display uninstall for plugins not published to gcom', async () => {
      const { queryByText, queryByRole } = renderPluginDetails({
        name: 'Akumuli',
        isInstalled: true,
        hasUpdate: false,
        type: PluginType.app,
        isPublished: false,
      });

      await waitFor(() => expect(queryByText(PluginTabLabels.OVERVIEW)).toBeInTheDocument());

      expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
    });
  });

  describe('viewed as user without grafana admin permissions', () => {
    beforeAll(() => {
      mockUserPermissions({
        isAdmin: false,
        isDataSourceEditor: false,
        isOrgAdmin: false,
      });
    });

    it("should not display an install button for a plugin that isn't installed", async () => {
      const { queryByRole, queryByText } = renderPluginDetails({ id, isInstalled: false });

      await waitFor(() => expect(queryByText(PluginTabLabels.OVERVIEW)).toBeInTheDocument());

      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });

    it('should not display an uninstall button for an already installed plugin', async () => {
      const { queryByRole, queryByText } = renderPluginDetails({ id, isInstalled: true });

      await waitFor(() => expect(queryByText(PluginTabLabels.OVERVIEW)).toBeInTheDocument());

      expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
    });

    it('should not display update or uninstall buttons for a plugin with update', async () => {
      const { queryByRole, queryByText } = renderPluginDetails({ id, isInstalled: true, hasUpdate: true });

      await waitFor(() => expect(queryByText(PluginTabLabels.OVERVIEW)).toBeInTheDocument());

      expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
      expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
    });

    it('should not display an install button for enterprise plugins if license is valid', async () => {
      config.licenseInfo.enabledFeatures = { 'enterprise.plugins': true };
      const { queryByRole, queryByText } = renderPluginDetails({ id, isInstalled: false, isEnterprise: true });

      await waitFor(() => expect(queryByText(PluginTabLabels.OVERVIEW)).toBeInTheDocument());

      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });
  });

  describe('viewed as user without data source edit permissions', () => {
    beforeAll(() => {
      mockUserPermissions({
        isAdmin: true,
        isDataSourceEditor: false,
        isOrgAdmin: true,
      });
    });

    it('should not display the data source post intallation step', async () => {
      const name = 'Akumuli';
      const { queryByText } = renderPluginDetails({
        name,
        isInstalled: true,
        type: PluginType.app,
      });

      await waitFor(() => queryByText('Uninstall'));
      expect(queryByText(`Create a ${name} data source`)).toBeNull();
    });
  });
});
