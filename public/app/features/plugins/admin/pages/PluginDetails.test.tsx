import React from 'react';
import { render, RenderResult, waitFor } from '@testing-library/react';
import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
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
          case API_ROOT:
            return Promise.resolve([localPlugin(), corePlugin()]);
          case `${GRAFANA_API_ROOT}/plugins/core`:
            return Promise.resolve(corePlugin());
          case `${GRAFANA_API_ROOT}/plugins/not-installed`:
            return Promise.resolve(remotePlugin());
          case `${GRAFANA_API_ROOT}/plugins/enterprise`:
            return Promise.resolve(remotePlugin({ status: 'enterprise' }));
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
    },
  };
});

function setup(pluginId: string): RenderResult {
  const props = getRouteComponentProps({ match: { params: { pluginId }, isExact: true, url: '', path: '' } });
  return render(<PluginDetailsPage {...props} />);
}

describe('Plugin details page', () => {
  it('should display install button for uninstalled plugins', async () => {
    const { getByText } = setup('not-installed');

    const expected = 'Install';

    await waitFor(() => expect(getByText(expected)).toBeInTheDocument());
  });

  it('should not display install button for enterprise plugins', async () => {
    const { queryByRole } = setup('enterprise');

    await waitFor(() => expect(queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument());
  });

  it('should not display install / uninstall buttons for core plugins', async () => {
    const { queryByRole } = setup('core');

    await waitFor(() => expect(queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument());
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
    readme: '',
    json: {
      dependencies: {
        grafanaDependency: '>=7.3.0',
        grafanaVersion: '7.3',
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
    category: '',
    defaultNavUrl: '/plugins/alertmanager/',
    info: {
      author: {
        name: 'Prometheus alertmanager',
        url: 'https://grafana.com',
      },
      build: {},
      description: '',
      links: [],
      logos: {
        small: '',
        large: '',
      },
      updated: '',
      version: '',
    },
    enabled: true,
    hasUpdate: false,
    id: 'alertmanager',
    latestVersion: '',
    name: 'Alert Manager',
    pinned: false,
    signature: PluginSignatureStatus.internal,
    signatureOrg: '',
    signatureType: '',
    state: 'alpha',
    type: PluginType.datasource,
    ...plugin,
  };
}

function corePlugin(plugin: Partial<LocalPlugin> = {}): LocalPlugin {
  return {
    category: 'sql',
    defaultNavUrl: '/plugins/postgres/',
    enabled: true,
    hasUpdate: false,
    id: 'core',
    info: {
      author: { name: 'Grafana Labs', url: 'https://grafana.com' },
      build: {},
      description: 'Data source for PostgreSQL and compatible databases',
      links: [],
      logos: {
        small: 'public/app/plugins/datasource/postgres/img/postgresql_logo.svg',
        large: 'public/app/plugins/datasource/postgres/img/postgresql_logo.svg',
      },
      updated: '',
      version: '',
    },
    latestVersion: '',
    name: 'PostgreSQL',
    pinned: false,
    signature: PluginSignatureStatus.internal,
    signatureOrg: '',
    signatureType: '',
    state: '',
    type: PluginType.datasource,
    ...plugin,
  };
}
