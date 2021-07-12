import React from 'react';
import { render, RenderResult, waitFor } from '@testing-library/react';
import PluginDetailsPage from './PluginDetails';
import { API_ROOT, GRAFANA_API_ROOT } from '../constants';
import { LocalPlugin, Plugin } from '../types';
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
            return Promise.resolve([localPlugin()]);
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

    await waitFor(() => getByText(expected));
    expect(getByText(expected)).toBeInTheDocument();
  });

  it('should not display install button for enterprise plugins', async () => {
    const { getByText } = setup('enterprise');

    const expected = "Marketplace doesn't support installing Enterprise plugins yet. Stay tuned!";

    await waitFor(() => getByText(expected));
    expect(getByText(expected)).toBeInTheDocument();
  });
});

function remotePlugin(plugin: Partial<Plugin> = {}): Plugin {
  return {
    createdAt: '2016-04-06T20:23:41.000Z',
    description: 'Zabbix plugin for Grafana',
    downloads: 33645089,
    featured: 180,
    internal: false,
    links: [],
    name: 'Zabbix',
    orgName: 'Alexander Zobnin',
    orgSlug: 'alexanderzobnin',
    packages: {},
    popularity: 0.2111,
    signatureType: 'community',
    slug: 'alexanderzobnin-zabbix-app',
    status: 'active',
    typeCode: 'app',
    updatedAt: '2021-05-18T14:53:01.000Z',
    version: '4.1.5',
    versionSignatureType: 'community',
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
    signature: 'internal',
    signatureOrg: '',
    signatureType: '',
    state: 'alpha',
    type: 'datasource',
    dev: false,
    ...plugin,
  };
}
