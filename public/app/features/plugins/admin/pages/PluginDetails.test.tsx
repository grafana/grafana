import React from 'react';
import { Provider } from 'react-redux';
import { render, RenderResult, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import PluginDetailsPage from './PluginDetails';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { CatalogPlugin } from '../types';
import { mockPluginApis, getCatalogPluginMock, getPluginsStateMock } from '../__mocks__';

// Mock the config to enable the plugin catalog
jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  const mockedRuntime = { ...original };

  mockedRuntime.config.bootData.user.isGrafanaAdmin = true;
  mockedRuntime.config.buildInfo.version = 'v8.1.0';
  mockedRuntime.config.pluginAdminEnabled = true;

  return mockedRuntime;
});

const renderPluginDetails = (pluginOverride: Partial<CatalogPlugin>): RenderResult => {
  const plugin = getCatalogPluginMock(pluginOverride);
  const { id } = plugin;
  const props = getRouteComponentProps({ match: { params: { pluginId: id }, isExact: true, url: '', path: '' } });
  const store = configureStore({
    plugins: getPluginsStateMock([plugin]),
  });

  return render(
    <Provider store={store}>
      <PluginDetailsPage {...props} />
    </Provider>
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

    const props = getRouteComponentProps({ match: { params: { pluginId: id }, isExact: true, url: '', path: '' } });
    const store = configureStore();
    const { queryByText } = render(
      <Provider store={store}>
        <PluginDetailsPage {...props} />
      </Provider>
    );

    await waitFor(() => expect(queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument());
  });

  it('should display an overview (plugin readme) by default', async () => {
    const { queryByText } = renderPluginDetails({ id });

    await waitFor(() => expect(queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument());
  });

  it('should display version history in case it is available', async () => {
    const { queryByText, getByText, getByRole } = renderPluginDetails({
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
    });

    // Check if version information is available
    await waitFor(() => expect(queryByText(/version history/i)).toBeInTheDocument());

    // Go to the versions tab
    userEvent.click(getByText(/version history/i));
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
});
