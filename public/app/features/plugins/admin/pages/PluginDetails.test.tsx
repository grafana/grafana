import { getDefaultNormalizer, RenderResult, SelectorMatcherOptions, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';

import {
  PluginErrorCode,
  PluginSignatureStatus,
  PluginType,
  dateTimeFormatTimeAgo,
  WithAccessControlMetadata,
} from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { config, getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import * as api from '../api';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { mockPluginApis, getCatalogPluginMock, getPluginsStateMock, mockUserPermissions } from '../mocks/mockHelpers';
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
  const runtime = jest.requireActual('@grafana/runtime');
  runtime.config.buildInfo.version = 'v8.1.0';

  return runtime;
});

jest.mock('../hooks/usePluginConfig.tsx', () => ({ usePluginConfig: jest.fn(() => ({ value: { meta: {} } })) }));

jest.mock('app/core/core', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/core').contextSrv,
    hasPermission: (action: string) => true,
    hasPermissionInMetadata: (action: string, object: WithAccessControlMetadata) => true,
  },
}));

const renderPluginDetails = (
  pluginOverride: Partial<CatalogPlugin>,
  { pageId, pluginsStateOverride }: { pageId?: PluginTabIds; pluginsStateOverride?: ReducerState } = {}
) => {
  const plugin = getCatalogPluginMock(pluginOverride);
  const { id } = plugin;
  const store = configureStore({ plugins: pluginsStateOverride || getPluginsStateMock([plugin]) });

  return render(
    <Routes>
      <Route path="/plugins/:pluginId" element={<PluginDetailsPage />} />
    </Routes>,

    { store, historyOptions: { initialEntries: [`/plugins/${id}${pageId ? `?page=${pageId}` : ''}`] } }
  );
};

describe('Plugin details page', () => {
  const id = 'my-plugin';
  const originalWindowLocation = window.location;
  let dateNow: jest.SpyInstance<number, []>;
  const originalBackendSrv = getBackendSrv();

  beforeAll(() => {
    dateNow = jest.spyOn(Date, 'now').mockImplementation(() => 1609470000000); // 2021-01-01 04:00:00

    // Enabling / disabling the plugin is currently reloading the page to propagate the changes
    Object.defineProperty(window, 'location', { configurable: true, value: { reload: jest.fn() } });
  });

  afterEach(() => {
    jest.clearAllMocks();
    config.pluginAdminExternalManageEnabled = false;
    config.licenseInfo.enabledFeatures = {};
    setBackendSrv(originalBackendSrv);
  });

  afterAll(() => {
    dateNow.mockRestore();
    Object.defineProperty(window, 'location', { configurable: true, value: originalWindowLocation });
  });

  describe('viewed as user with grafana admin permissions', () => {
    beforeAll(() => {
      mockUserPermissions({ isAdmin: true, isDataSourceEditor: true, isOrgAdmin: true });
    });

    // We are doing this very basic test to see if the API fetching and data-munging is working correctly from a high-level.
    it('(SMOKE TEST) - should fetch and merge the remote and local plugin API responses correctly ', async () => {
      const id = 'smoke-test-plugin';

      mockPluginApis({ remote: { slug: id }, local: { id } });

      const { queryByText } = renderPluginDetails({ id });

      await waitFor(() => expect(queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument());
    });

    it('should display an overview (plugin readme) by default', async () => {
      const { queryByText } = renderPluginDetails({ id });

      expect(await queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument();
    });

    it('should display an app config page by default for installed app plugins', async () => {
      const name = 'Akumuli';

      // @ts-ignore
      usePluginConfig.mockReturnValue({
        value: {
          meta: { type: PluginType.app, enabled: false, pinned: false, jsonData: {} },
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

      const { queryByText } = renderPluginDetails({ name, isInstalled: true, type: PluginType.app });

      expect(await queryByText(/custom config page/i)).toBeInTheDocument();
    });

    it('should display the number of downloads in the header', async () => {
      // depending on what locale you have the Intl.NumberFormat will return a format that contains
      // whitespaces. In that case we don't want testing library to remove whitespaces.
      const downloads = 24324;
      const options: SelectorMatcherOptions = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };
      const expected = new Intl.NumberFormat().format(downloads);

      const { queryByText } = renderPluginDetails({ id, downloads });
      expect(await queryByText(expected, options)).toBeInTheDocument();
    });

    it('should display the installed version if a plugin is installed', async () => {
      const installedVersion = '1.3.443';
      const isInstalled = true;
      const { queryByText } = renderPluginDetails({ id, isInstalled, installedVersion });

      expect(await queryByText(`${installedVersion}`)).toBeInTheDocument();
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

      const { findByText, queryByText } = renderPluginDetails({ id, details });
      expect(await findByText('4.2.2')).toBeInTheDocument();
      expect(queryByText(/>=8.0.0/i)).toBeInTheDocument();
    });

    it('should display description in the header', async () => {
      const description = 'This is my description';
      const { queryByText } = renderPluginDetails({ id, description });

      expect(await queryByText(description)).toBeInTheDocument();
    });

    it('should display a "Signed" badge if the plugin signature is verified', async () => {
      const { queryByText } = renderPluginDetails({ id, signature: PluginSignatureStatus.valid });

      expect(await queryByText('community')).toBeInTheDocument();
    });

    it('should display a "Missing signature" badge if the plugin signature is missing', async () => {
      const { queryByText } = renderPluginDetails({ id, signature: PluginSignatureStatus.missing });

      expect(await queryByText('Missing signature')).toBeInTheDocument();
    });

    it('should display a "Modified signature" badge if the plugin signature is modified', async () => {
      const { queryByText } = renderPluginDetails({ id, signature: PluginSignatureStatus.modified });

      expect(await queryByText('Modified signature')).toBeInTheDocument();
    });

    it('should display a "Invalid signature" badge if the plugin signature is invalid', async () => {
      const { queryByText } = renderPluginDetails({ id, signature: PluginSignatureStatus.invalid });

      expect(await queryByText('Invalid signature')).toBeInTheDocument();
    });

    it('should display version history if the plugin is published', async () => {
      const versions = [
        { version: '1.2.0', createdAt: '2018-04-06T20:23:41.000Z', isCompatible: false, grafanaDependency: '>=8.3.0' },
        { version: '1.1.0', createdAt: '2017-04-06T20:23:41.000Z', isCompatible: true, grafanaDependency: '>=8.0.0' },
        { version: '1.0.0', createdAt: '2016-04-06T20:23:41.000Z', isCompatible: true, grafanaDependency: '>=7.0.0' },
      ];

      const { findByRole, queryByText, getByRole } = renderPluginDetails(
        { id, details: { links: [], versions } },
        { pageId: PluginTabIds.VERSIONS }
      );

      // Check if version information is available
      expect(await findByRole('tab', { name: PluginTabLabels.VERSIONS })).toBeInTheDocument();

      // Check the column headers
      expect(getByRole('columnheader', { name: /version/i })).toBeInTheDocument();
      expect(getByRole('columnheader', { name: /latest release date/i })).toBeInTheDocument();

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

      expect(await queryByRole('button', { name: /^install/i })).toBeInTheDocument();
      // Does not display "uninstall" button
      expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
    });

    it('should display an uninstall button for an already installed plugin', async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: true });

      expect(await queryByRole('button', { name: /uninstall/i })).toBeInTheDocument();
      // Does not display "install" button
      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });

    it('should display update and uninstall buttons for a plugin with update', async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: true, hasUpdate: true });

      // Displays an "update" button
      expect(await queryByRole('button', { name: /update/i })).toBeInTheDocument();
      expect(queryByRole('button', { name: /uninstall/i })).toBeInTheDocument();

      // Does not display "install" button
      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });

    it('should not display an update button for a plugin that is managed', async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: true, hasUpdate: true, isManaged: true });

      // Does not display an "update" button
      expect(await queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
      expect(queryByRole('button', { name: /uninstall/i })).toBeInTheDocument();

      // Does not display "install" button
      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });

    it('should not display an update button for a plugin that is pre installed', async () => {
      const { queryByRole, getByText } = renderPluginDetails({
        id,
        isInstalled: true,
        hasUpdate: true,
        isPreinstalled: { found: true, withVersion: true },
      });

      // Does not display an "update" button
      expect(await queryByRole('button', { name: /update/i })).not.toBeInTheDocument();

      // Does not display "install" button
      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();

      // Display an uninstall button but disabled
      expect(getByText(/Uninstall/i).closest('button')).toBeDisabled();
    });

    it('should display an install button for enterprise plugins if license is valid', async () => {
      config.licenseInfo.enabledFeatures = { 'enterprise.plugins': true };
      config.licenseInfo.stateInfo = 'Licensed';

      const { queryByRole } = renderPluginDetails({ id, isInstalled: false, isEnterprise: true });

      expect(await queryByRole('button', { name: /install/i })).toBeInTheDocument();
      config.licenseInfo.stateInfo = '';
    });

    it('should not display install button for enterprise plugins if license is invalid (but allow uninstall)', async () => {
      config.licenseInfo.enabledFeatures = {};
      config.buildInfo.edition = GrafanaEdition.Enterprise;

      const { queryByRole, queryByText } = renderPluginDetails({ id, isInstalled: true, isEnterprise: true });

      expect(await queryByRole('button', { name: /Install/ })).not.toBeInTheDocument();
      expect(await queryByRole('button', { name: /Uninstall/ })).toBeInTheDocument();
      expect(queryByText(/This plugin is only available in Grafana Cloud and Grafana Enterprise./i)).toBeInTheDocument();
      expect(queryByRole('link', { name: /learn more/i })).toBeInTheDocument();
    });

    it('should not display install / uninstall buttons for core plugins', async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: true, isCore: true });

      expect(await queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
      expect(await queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument();
    });

    it('should not display install / uninstall buttons for disabled plugins', async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: true, isDisabled: true });

      expect(await queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
      expect(await queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument();
    });

    it('should not display install / uninstall buttons for renderer plugins', async () => {
      const { queryByRole } = renderPluginDetails({ id, type: PluginType.renderer });

      expect(await queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
      expect(await queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument();
    });

    it('should not display install / uninstall buttons for provisioned plugins', async () => {
      const { queryByRole } = renderPluginDetails({ id, isProvisioned: true });

      expect(await queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
      expect(await queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument();
    });

    it('should display alert with information about why the plugin is disabled', async () => {
      const { queryByTestId } = renderPluginDetails({
        id,
        isInstalled: true,
        isDisabled: true,
        error: PluginErrorCode.modifiedSignature,
      });

      expect(queryByTestId(selectors.pages.PluginPage.disabledInfo)).toBeInTheDocument();
    });

    it('should display grafana dependencies for a plugin if they are available', async () => {
      const { queryByText } = renderPluginDetails({
        id,
        details: { pluginDependencies: [], grafanaDependency: '>=8.0.0', links: [] },
      });

      // Wait for the dependencies part to be loaded
      expect(await queryByText('Grafana >=8.0.0')).toBeInTheDocument();
    });

    it('should show a confirm modal when trying to uninstall a plugin', async () => {
      // @ts-ignore
      api.uninstallPlugin = jest.fn();

      setBackendSrv({ ...originalBackendSrv, get: jest.fn().mockResolvedValue({ panels: [] }) });

      const { queryByText, getByRole, findByRole, user } = renderPluginDetails({
        id,
        name: 'Akumuli',
        isInstalled: true,
        details: {
          pluginDependencies: [],
          grafanaDependency: '>=8.0.0',
          links: [],
          versions: [{ version: '1.0.0', createdAt: '', isCompatible: true, grafanaDependency: '>=8.0.0' }],
        },
      });

      // Wait for the install controls to be loaded
      expect(await findByRole('tab', { name: PluginTabLabels.OVERVIEW })).toBeInTheDocument();

      // Open the confirmation modal
      await user.click(getByRole('button', { name: /uninstall/i }));

      expect(queryByText('Uninstall Akumuli')).toBeInTheDocument();
      expect(queryByText('Are you sure you want to uninstall this plugin?')).toBeInTheDocument();
      expect(api.uninstallPlugin).toHaveBeenCalledTimes(0);

      // Confirm the uninstall
      await user.click(getByRole('button', { name: /confirm/i }));
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
        requests: { ...state.requests, [fetchRemotePlugins.typePrefix]: { status: RequestStatus.Rejected } },
      };

      // Does not show an Install button
      rendered = renderPluginDetails({ id }, { pluginsStateOverride });
      expect(rendered.queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument();
      rendered.unmount();

      // Does not show a Uninstall button
      rendered = renderPluginDetails({ id, isInstalled: true }, { pluginsStateOverride });
      expect(rendered.queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument();
      rendered.unmount();

      // Does not show an Update button
      rendered = renderPluginDetails({ id, isInstalled: true, hasUpdate: true }, { pluginsStateOverride });
      expect(rendered.queryByRole('button', { name: /update/i })).not.toBeInTheDocument();

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
      expect(rendered.queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
      rendered.unmount();

      // Should not show an "Uninstall" button
      rendered = renderPluginDetails({ id, isInstalled: true });
      expect(rendered.queryByRole('button', { name: /^uninstall/i })).not.toBeInTheDocument();
      rendered.unmount();

      // Should not show an "Update" button
      rendered = renderPluginDetails({ id, isInstalled: true, hasUpdate: true });
      expect(rendered.queryByRole('button', { name: /^update/i })).not.toBeInTheDocument();
    });

    it('should display a "Create" button as a post installation step for installed data source plugins', async () => {
      const name = 'Akumuli';
      const { queryByText } = renderPluginDetails({ name, isInstalled: true, type: PluginType.datasource });

      await waitFor(() => queryByText('Uninstall'));
      expect(queryByText('Add new data source')).toBeInTheDocument();
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
      expect(queryByText('Add new data source')).toBeNull();
    });

    it('should not display post installation step for panel plugins', async () => {
      const name = 'Akumuli';
      const { queryByText } = renderPluginDetails({ name, isInstalled: true, type: PluginType.panel });

      await waitFor(() => queryByText('Uninstall'));
      expect(queryByText('Add new data source')).toBeNull();
    });

    it('should display an enable button for app plugins that are not enabled as a post installation step', async () => {
      const name = 'Akumuli';

      // @ts-ignore
      usePluginConfig.mockReturnValue({ value: { meta: { enabled: false, pinned: false, jsonData: {} } } });

      const { queryByText, queryByRole } = renderPluginDetails({ name, isInstalled: true, type: PluginType.app });

      await waitFor(() => queryByText('Uninstall'));

      expect(queryByRole('button', { name: /enable/i })).toBeInTheDocument();
      expect(queryByRole('button', { name: /disable/i })).not.toBeInTheDocument();
    });

    it('should display a disable button for app plugins that are enabled as a post installation step', async () => {
      const name = 'Akumuli';

      // @ts-ignore
      usePluginConfig.mockReturnValue({ value: { meta: { enabled: true, pinned: false, jsonData: {} } } });

      const { queryByText, queryByRole } = renderPluginDetails({ name, isInstalled: true, type: PluginType.app });

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
      usePluginConfig.mockReturnValue({ value: { meta: { enabled: false, pinned: false, jsonData: {} } } });

      const { queryByText, getByRole, user } = renderPluginDetails({
        id,
        name,
        isInstalled: true,
        type: PluginType.app,
      });

      // Wait for the header to be loaded
      await waitFor(() => queryByText('Uninstall'));

      // Click on "Enable"
      await user.click(getByRole('button', { name: /enable/i }));

      // Check if the API request was initiated
      expect(api.updatePluginSettings).toHaveBeenCalledTimes(1);
      expect(api.updatePluginSettings).toHaveBeenCalledWith(id, { enabled: true, pinned: true, jsonData: {} });
    });

    it('should be possible to disable an app plugin', async () => {
      const id = 'akumuli-datasource';
      const name = 'Akumuli';

      // @ts-ignore
      api.updatePluginSettings = jest.fn();

      // @ts-ignore
      usePluginConfig.mockReturnValue({ value: { meta: { enabled: true, pinned: true, jsonData: {} } } });

      const { queryByText, getByRole, user } = renderPluginDetails({
        id,
        name,
        isInstalled: true,
        type: PluginType.app,
      });

      // Wait for the header to be loaded
      await waitFor(() => queryByText('Uninstall'));

      // Click on "Disable"
      await user.click(getByRole('button', { name: /disable/i }));

      // Check if the API request was initiated
      expect(api.updatePluginSettings).toHaveBeenCalledTimes(1);
      expect(api.updatePluginSettings).toHaveBeenCalledWith(id, { enabled: false, pinned: false, jsonData: {} });
    });

    it('should not display versions tab for plugins not published to gcom', async () => {
      const { queryByRole } = renderPluginDetails({
        name: 'Akumuli',
        isInstalled: true,
        type: PluginType.app,
        isPublished: false,
      });

      expect(await queryByRole('tab', { name: PluginTabLabels.VERSIONS })).not.toBeInTheDocument();
    });

    it('should not display update for plugins not published to gcom', async () => {
      const { findByRole, queryByRole } = renderPluginDetails({
        name: 'Akumuli',
        isInstalled: true,
        hasUpdate: true,
        type: PluginType.app,
        isPublished: false,
      });

      expect(await findByRole('tab', { name: PluginTabLabels.OVERVIEW })).toBeInTheDocument();

      expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
    });

    it('should not display install for plugins not published to gcom', async () => {
      const { findByRole, queryByRole } = renderPluginDetails({
        name: 'Akumuli',
        isInstalled: false,
        hasUpdate: false,
        type: PluginType.app,
        isPublished: false,
      });

      expect(await findByRole('tab', { name: PluginTabLabels.OVERVIEW })).toBeInTheDocument();

      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });

    it('should not display uninstall for plugins not published to gcom', async () => {
      const { findByRole, queryByRole } = renderPluginDetails({
        name: 'Akumuli',
        isInstalled: true,
        hasUpdate: false,
        type: PluginType.app,
        isPublished: false,
      });

      expect(await findByRole('tab', { name: PluginTabLabels.OVERVIEW })).toBeInTheDocument();

      expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
    });

    it('shows a "angular warning" if the plugin uses Angular', async () => {
      const { queryByText } = renderPluginDetails({ angularDetected: true });

      await waitFor(() => expect(queryByText(/angular plugin/i)).toBeInTheDocument);
    });

    it('does not show an "angular warning" if the plugin is not using Angular', async () => {
      const { queryByText } = renderPluginDetails({ angularDetected: false });

      await waitFor(() => expect(queryByText(/angular plugin/i)).not.toBeInTheDocument);
    });

    it('should display a deprecation warning if the plugin is deprecated', async () => {
      const { findByRole } = renderPluginDetails({ id, isInstalled: true, isDeprecated: true });

      expect(await findByRole('link', { name: 'deprecated' })).toBeInTheDocument();
    });

    it('should not display a deprecation warning in the plugin is not deprecated', async () => {
      const { queryByRole } = renderPluginDetails({ id, isInstalled: true, isDeprecated: false });

      await waitFor(() => expect(queryByRole('link', { name: 'deprecated' })).not.toBeInTheDocument());
    });

    it('should display a custom deprecation message if the plugin has it set', async () => {
      const statusContext = 'A detailed explanation of why this plugin is deprecated.';
      const { findByText, findByRole } = renderPluginDetails({
        id,
        isInstalled: true,
        isDeprecated: true,
        details: { statusContext, links: [] },
      });

      expect(await findByRole('link', { name: 'deprecated' })).toBeInTheDocument();
      expect(await findByText(statusContext)).toBeInTheDocument();
    });

    it('should be possible to render markdown inside a custom deprecation message', async () => {
      const statusContext =
        '**This is a custom deprecation message.** [Link 1](https://grafana.com) <a href="https://grafana.com" target="_blank">Link 2</a>';
      const { findByText, findByRole } = renderPluginDetails({
        id,
        isInstalled: true,
        isDeprecated: true,
        details: { statusContext, links: [] },
      });

      expect(await findByRole('link', { name: 'deprecated' })).toBeInTheDocument();
      expect(await findByText('This is a custom deprecation message.')).toBeInTheDocument();
      expect(await findByRole('link', { name: 'Link 1' })).toBeInTheDocument();
      expect(await findByRole('link', { name: 'Link 2' })).toBeInTheDocument();
      expect(await findByRole('link', { name: 'Link 2' })).toHaveAttribute('href', 'https://grafana.com');
    });
  });

  describe('viewed as user without grafana admin permissions', () => {
    beforeAll(() => {
      mockUserPermissions({ isAdmin: false, isDataSourceEditor: false, isOrgAdmin: false });
    });

    it("should not display an install button for a plugin that isn't installed", async () => {
      const { queryByRole, findByRole } = renderPluginDetails({ id, isInstalled: false });

      expect(await findByRole('tab', { name: PluginTabLabels.OVERVIEW })).toBeInTheDocument();

      expect(queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });

    it('should not display an uninstall button for an already installed plugin', async () => {
      const { queryByRole, findByRole } = renderPluginDetails({ id, isInstalled: true });

      expect(await findByRole('tab', { name: PluginTabLabels.OVERVIEW })).toBeInTheDocument();

      expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
    });

    it('should not display update or uninstall buttons for a plugin with update', async () => {
      const { queryByRole, findByRole } = renderPluginDetails({ id, isInstalled: true, hasUpdate: true });

      expect(await findByRole('tab', { name: PluginTabLabels.OVERVIEW })).toBeInTheDocument();

      expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
      expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
    });

    it('should not display an install button for enterprise plugins if license is valid', async () => {
      const { findByRole, queryByRole } = renderPluginDetails({ id, isInstalled: false, isEnterprise: true });

      expect(await findByRole('tab', { name: PluginTabLabels.OVERVIEW })).toBeInTheDocument();
      expect(await queryByRole('button', { name: /^install/i })).not.toBeInTheDocument();
    });
  });

  describe('viewed as user without data source edit permissions', () => {
    beforeAll(() => {
      mockUserPermissions({ isAdmin: true, isDataSourceEditor: false, isOrgAdmin: true });
    });

    it('should not display the data source post installation step', async () => {
      const name = 'Akumuli';
      const { queryByText } = renderPluginDetails({ name, isInstalled: true, type: PluginType.app });

      await waitFor(() => queryByText('Uninstall'));
      expect(queryByText('Add new data source')).toBeNull();
    });
  });

  describe('Display plugin details right panel', () => {
    beforeAll(() => {
      mockUserPermissions({ isAdmin: true, isDataSourceEditor: false, isOrgAdmin: true });
    });

    it('should display Latest release date and report a concern information', async () => {
      const id = 'right-panel-test-plugin';
      const updatedAt = '2023-10-26T16:54:55.000Z';
      const { queryByText } = renderPluginDetails({ id, updatedAt });
      expect(queryByText('Latest release date:')).toBeVisible();
      expect(queryByText('Oct 26, 2023')).toBeVisible();
      expect(queryByText('Report a concern')).toBeVisible();
    });

    it('should not display Last updated if there is no updated At data', async () => {
      const id = 'right-panel-test-plugin';
      const updatedAt = undefined;
      const { queryByText } = renderPluginDetails({ id, updatedAt });
      expect(queryByText('Last updated:')).toBeNull();
    });

    it('should not display Report Abuse if the plugin is Core', async () => {
      const id = 'right-panel-test-plugin';
      const isCore = true;
      const { queryByText } = renderPluginDetails({ id, isCore });
      expect(queryByText('Report Abuse')).toBeNull();
    });
  });
});
