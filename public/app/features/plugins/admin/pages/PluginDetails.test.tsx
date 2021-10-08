import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, RenderResult, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import PluginDetailsPage from './PluginDetails';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { CatalogPlugin, PluginTabIds, RequestStatus, ReducerState } from '../types';
import * as api from '../api';
import { fetchRemotePlugins } from '../state/actions';
import { mockPluginApis, getCatalogPluginMock, getPluginsStateMock } from '../__mocks__';
import { PluginErrorCode, PluginSignatureStatus } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  const mockedRuntime = { ...original };

  mockedRuntime.config.bootData.user.isGrafanaAdmin = true;
  mockedRuntime.config.buildInfo.version = 'v8.1.0';

  return mockedRuntime;
});

const renderPluginDetails = (
  pluginOverride: Partial<CatalogPlugin>,
  {
    pageId = PluginTabIds.OVERVIEW,
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
      search: `?page=${pageId}`,
      state: undefined,
    },
  });
  const store = configureStore({
    plugins: pluginsStateOverride || getPluginsStateMock([plugin]),
  });

  return render(
    <Provider store={store}>
      <PluginDetailsPage {...props} />
    </Provider>,
    { wrapper: MemoryRouter }
  );
};

describe('Plugin details page', () => {
  const id = 'my-plugin';
  let dateNow: any;

  beforeAll(() => {
    dateNow = jest.spyOn(Date, 'now').mockImplementation(() => 1609470000000); // 2021-01-01 04:00:00
  });

  afterEach(() => {
    jest.clearAllMocks();
    config.pluginAdminExternalManageEnabled = false;
    config.licenseInfo.hasValidLicense = false;
  });

  afterAll(() => {
    dateNow.mockRestore();
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
      queryParams: { page: PluginTabIds.OVERVIEW },
      location: {
        hash: '',
        pathname: `/plugins/${id}`,
        search: `?page=${PluginTabIds.OVERVIEW}`,
        state: undefined,
      },
    });
    const store = configureStore();
    const { queryByText } = render(
      <Provider store={store}>
        <PluginDetailsPage {...props} />
      </Provider>,
      { wrapper: MemoryRouter }
    );

    await waitFor(() => expect(queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument());
  });

  it('should display an overview (plugin readme) by default', async () => {
    const { queryByText } = renderPluginDetails({ id });

    await waitFor(() => expect(queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument());
  });

  it('should display the number of downloads in the header', async () => {
    const downloads = 24324;
    const { queryByText } = renderPluginDetails({ id, downloads });

    await waitFor(() => expect(queryByText(new Intl.NumberFormat().format(downloads))).toBeInTheDocument());
  });

  it('should display the version in the header', async () => {
    const version = '1.3.443';
    const { queryByText } = renderPluginDetails({ id, version });

    await waitFor(() => expect(queryByText(version)).toBeInTheDocument());
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

  it('should display version history in case it is available', async () => {
    const { queryByText, getByRole } = renderPluginDetails(
      {
        id,
        details: {
          links: [],
          versions: [
            {
              version: '1.0.0',
              createdAt: '2016-04-06T20:23:41.000Z',
            },
          ],
        },
      },
      { pageId: PluginTabIds.VERSIONS }
    );

    // Check if version information is available
    await waitFor(() => expect(queryByText(/version history/i)).toBeInTheDocument());

    expect(
      getByRole('columnheader', {
        name: /version/i,
      })
    ).toBeInTheDocument();
    expect(
      getByRole('columnheader', {
        name: /last updated/i,
      })
    ).toBeInTheDocument();
    expect(
      getByRole('cell', {
        name: /1\.0\.0/i,
      })
    ).toBeInTheDocument();
    expect(
      getByRole('cell', {
        name: /5 years ago/i,
      })
    ).toBeInTheDocument();
  });

  it("should display an install button for a plugin that isn't installed", async () => {
    const { queryByRole } = renderPluginDetails({ id, isInstalled: false });

    await waitFor(() => expect(queryByRole('button', { name: /install/i })).toBeInTheDocument());
    expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
  });

  it('should display an uninstall button for an already installed plugin', async () => {
    const { queryByRole } = renderPluginDetails({ id, isInstalled: true });

    await waitFor(() => expect(queryByRole('button', { name: /uninstall/i })).toBeInTheDocument());
  });

  it('should display update and uninstall buttons for a plugin with update', async () => {
    const { queryByRole } = renderPluginDetails({ id, isInstalled: true, hasUpdate: true });

    // Displays an "update" button
    await waitFor(() => expect(queryByRole('button', { name: /update/i })).toBeInTheDocument());

    // Does not display "install" and "uninstall" buttons
    expect(queryByRole('button', { name: /install/i })).toBeInTheDocument();
    expect(queryByRole('button', { name: /uninstall/i })).toBeInTheDocument();
  });

  it('should display an install button for enterprise plugins if license is valid', async () => {
    config.licenseInfo.hasValidLicense = true;

    const { queryByRole } = renderPluginDetails({ id, isInstalled: false, isEnterprise: true });

    await waitFor(() => expect(queryByRole('button', { name: /install/i })).toBeInTheDocument());
  });

  it('should not display install button for enterprise plugins if license is invalid', async () => {
    config.licenseInfo.hasValidLicense = false;

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

    const { queryByText, queryByRole, getByRole } = renderPluginDetails({
      id,
      name: 'Akumuli',
      isInstalled: true,
      details: {
        pluginDependencies: [],
        grafanaDependency: '>=8.0.0',
        links: [],
      },
    });

    // Wait for the install controls to be loaded
    await waitFor(() => expect(queryByRole('button', { name: /install/i })).toBeInTheDocument());

    // Open the confirmation modal
    userEvent.click(getByRole('button', { name: /uninstall/i }));

    expect(queryByText('Uninstall Akumuli')).toBeInTheDocument();
    expect(queryByText('Are you sure you want to uninstall this plugin?')).toBeInTheDocument();
    expect(api.uninstallPlugin).toHaveBeenCalledTimes(0);

    // Confirm the uninstall
    userEvent.click(getByRole('button', { name: /confirm/i }));
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
});
