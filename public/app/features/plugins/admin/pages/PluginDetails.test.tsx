import React from 'react';
import { Provider } from 'react-redux';
import { render, RenderResult, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { config } from '@grafana/runtime';
import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';
import PluginDetailsPage from './PluginDetails';
import { API_ROOT, GRAFANA_API_ROOT } from '../constants';
import { LocalPlugin, RemotePlugin } from '../types';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');

  return {
    ...original,
    getBackendSrv: () => ({
      get: (path: string) => {
        switch (path) {
          case `${GRAFANA_API_ROOT}/plugins/not-installed/versions`:
          case `${GRAFANA_API_ROOT}/plugins/enterprise/versions`:
            return Promise.resolve([]);
          case `${GRAFANA_API_ROOT}/plugins/installed/versions`:
            return Promise.resolve({
              items: [
                {
                  version: '1.0.0',
                  createdAt: '2016-04-06T20:23:41.000Z',
                },
              ],
            });
          case API_ROOT:
            return Promise.resolve([
              localPlugin(),
              localPlugin({ id: 'installed', signature: PluginSignatureStatus.valid }),
              localPlugin({ id: 'has-update', signature: PluginSignatureStatus.valid }),
              localPlugin({ id: 'core', signature: PluginSignatureStatus.internal }),
            ]);
          case `${GRAFANA_API_ROOT}/plugins/core`:
            return Promise.resolve(localPlugin({ id: 'core', signature: PluginSignatureStatus.internal }));
          case `${GRAFANA_API_ROOT}/plugins/not-installed`:
            return Promise.resolve(remotePlugin());
          case `${GRAFANA_API_ROOT}/plugins/has-update`:
            return Promise.resolve(remotePlugin({ slug: 'has-update', version: '2.0.0' }));
          case `${GRAFANA_API_ROOT}/plugins/installed`:
            return Promise.resolve(remotePlugin({ slug: 'installed' }));
          case `${GRAFANA_API_ROOT}/plugins/enterprise`:
            return Promise.resolve(remotePlugin({ status: 'enterprise' }));
          case `${GRAFANA_API_ROOT}/plugins`:
            return Promise.resolve({
              items: [
                remotePlugin({ slug: 'not-installed' }),
                remotePlugin({ slug: 'installed' }),
                remotePlugin({ slug: 'has-update', version: '2.0.0' }),
                remotePlugin({ slug: 'enterprise', status: 'enterprise' }),
              ],
            });
          default:
            return Promise.reject();
        }
      },
    }),
    config: {
      ...original.config,
      bootData: {
        ...original.config.bootData,
        user: {
          ...original.config.bootData.user,
          isGrafanaAdmin: true,
        },
      },
      buildInfo: {
        ...original.config.buildInfo,
        version: 'v7.5.0',
      },
      pluginAdminEnabled: true,
    },
  };
});

function setup(pluginId: string): RenderResult {
  const props = getRouteComponentProps({ match: { params: { pluginId }, isExact: true, url: '', path: '' } });
  const store = configureStore();
  return render(
    <Provider store={store}>
      <PluginDetailsPage {...props} />
    </Provider>
  );
}

describe('Plugin details page', () => {
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

  it('should display an overview (plugin readme) by default', async () => {
    const { queryByText } = setup('not-installed');

    await waitFor(() => expect(queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument());
  });

  it('should display version history', async () => {
    const { queryByText, getByText, getByRole } = setup('installed');
    await waitFor(() => expect(queryByText(/version history/i)).toBeInTheDocument());
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

  it("should display install button for a plugin that isn't installed", async () => {
    const { queryByRole } = setup('not-installed');

    await waitFor(() => expect(queryByRole('button', { name: /install/i })).toBeInTheDocument());
    expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
  });

  it('should display uninstall button for an installed plugin', async () => {
    const { queryByRole } = setup('installed');
    await waitFor(() => expect(queryByRole('button', { name: /uninstall/i })).toBeInTheDocument());
  });

  it('should display update and uninstall buttons for a plugin with update', async () => {
    const { queryByRole } = setup('has-update');

    await waitFor(() => expect(queryByRole('button', { name: /update/i })).toBeInTheDocument());
    expect(queryByRole('button', { name: /uninstall/i })).toBeInTheDocument();
  });

  it('should display install button for enterprise plugins if license is valid', async () => {
    config.licenseInfo.hasValidLicense = true;
    const { queryByRole } = setup('enterprise');

    await waitFor(() => expect(queryByRole('button', { name: /install/i })).toBeInTheDocument());
  });

  it('should not display install button for enterprise plugins if license is invalid', async () => {
    config.licenseInfo.hasValidLicense = false;
    const { queryByRole, queryByText } = setup('enterprise');

    await waitFor(() => expect(queryByRole('button', { name: /install/i })).not.toBeInTheDocument());
    expect(queryByText(/no valid Grafana Enterprise license detected/i)).toBeInTheDocument();
    expect(queryByRole('link', { name: /learn more/i })).toBeInTheDocument();
  });

  it('should not display install / uninstall buttons for core plugins', async () => {
    const { queryByRole } = setup('core');

    await waitFor(() => expect(queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument());
  });

  it('should display install link with pluginAdminExternalManageEnabled true', async () => {
    config.pluginAdminExternalManageEnabled = true;
    const { queryByRole } = setup('not-installed');

    await waitFor(() => expect(queryByRole('link', { name: /install via grafana.com/i })).toBeInTheDocument());
  });

  it('should display uninstall link for an installed plugin with pluginAdminExternalManageEnabled true', async () => {
    config.pluginAdminExternalManageEnabled = true;
    const { queryByRole } = setup('installed');
    await waitFor(() => expect(queryByRole('link', { name: /uninstall via grafana.com/i })).toBeInTheDocument());
  });

  it('should display update and uninstall links for a plugin with update and pluginAdminExternalManageEnabled true', async () => {
    config.pluginAdminExternalManageEnabled = true;
    const { queryByRole } = setup('has-update');

    await waitFor(() => expect(queryByRole('link', { name: /update via grafana.com/i })).toBeInTheDocument());
    expect(queryByRole('link', { name: /uninstall via grafana.com/i })).toBeInTheDocument();
  });

  it('should display grafana dependencies for a plugin if they are available', async () => {
    const { queryByText } = setup('not-installed');

    // Wait for the dependencies part to be loaded
    await waitFor(() => expect(queryByText(/dependencies:/i)).toBeInTheDocument());

    expect(queryByText('Grafana >=7.3.0')).toBeInTheDocument();
  });
});

function remotePlugin(plugin: Partial<RemotePlugin> = {}): RemotePlugin {
  return {
    createdAt: '2016-04-06T20:23:41.000Z',
    description: 'Zabbix plugin for Grafana',
    downloads: 33645089,
    featured: 180,
    id: 74,
    typeId: 1,
    typeName: 'Application',
    internal: false,
    links: [],
    name: 'Zabbix',
    orgId: 13056,
    orgName: 'Alexander Zobnin',
    orgSlug: 'alexanderzobnin',
    orgUrl: 'https://github.com/alexanderzobnin',
    url: 'https://github.com/alexanderzobnin/grafana-zabbix',
    verified: false,
    downloadSlug: 'alexanderzobnin-zabbix-app',
    packages: {},
    popularity: 0.2111,
    signatureType: PluginSignatureType.community,
    slug: 'alexanderzobnin-zabbix-app',
    status: 'active',
    typeCode: PluginType.app,
    updatedAt: '2021-05-18T14:53:01.000Z',
    version: '4.1.5',
    versionStatus: 'active',
    versionSignatureType: PluginSignatureType.community,
    versionSignedByOrg: 'alexanderzobnin',
    versionSignedByOrgName: 'Alexander Zobnin',
    userId: 0,
    readme:
      '<h1>Zabbix plugin for Grafana</h1>\n<p>:copyright: 2015-2021 Alexander Zobnin alexanderzobnin@gmail.com</p>\n<p>Licensed under the Apache 2.0 License</p>',
    json: {
      dependencies: {
        grafanaDependency: '>=7.3.0',
        grafanaVersion: '7.3',
        plugins: [],
      },
      info: {
        links: [],
      },
    },
    ...plugin,
  };
}

function localPlugin(plugin: Partial<LocalPlugin> = {}): LocalPlugin {
  return {
    name: 'Akumuli',
    type: PluginType.datasource,
    id: 'akumuli-datasource',
    enabled: true,
    pinned: false,
    info: {
      author: {
        name: 'Eugene Lazin',
        url: 'https://akumuli.org',
      },
      description: 'Datasource plugin for Akumuli time-series database',
      links: [
        {
          name: 'Project site',
          url: 'https://github.com/akumuli/Akumuli',
        },
      ],
      logos: {
        small: 'public/plugins/akumuli-datasource/img/logo.svg.png',
        large: 'public/plugins/akumuli-datasource/img/logo.svg.png',
      },
      build: {},
      screenshots: null,
      version: '1.3.12',
      updated: '2019-12-19',
    },
    latestVersion: '1.3.12',
    hasUpdate: false,
    defaultNavUrl: '/plugins/akumuli-datasource/',
    category: '',
    state: '',
    signature: PluginSignatureStatus.valid,
    signatureType: PluginSignatureType.core,
    signatureOrg: 'Grafana Labs',
    ...plugin,
  };
}
