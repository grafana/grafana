import React from 'react';
import { Router } from 'react-router-dom';
import { render, RenderResult, waitFor } from '@testing-library/react';
import BrowsePage from './Browse';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { LocalPlugin, Plugin } from '../types';
import { API_ROOT, GRAFANA_API_ROOT } from '../constants';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as object),
  getBackendSrv: () => ({
    get: (path: string) => {
      switch (path) {
        case `${GRAFANA_API_ROOT}/plugins`:
          return Promise.resolve({ items: remote });
        case API_ROOT:
          return Promise.resolve(installed);
        default:
          return Promise.reject();
      }
    },
  }),
}));

function setup(path = '/plugins'): RenderResult {
  const store = configureStore();
  locationService.push(path);

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <BrowsePage />
      </Router>
    </Provider>
  );
}

describe('Browse list of plugins', () => {
  it('should list installed plugins by default', async () => {
    const { queryByText } = setup('/plugins');

    await waitFor(() => queryByText('Installed'));

    for (const plugin of installed) {
      expect(queryByText(plugin.name)).toBeInTheDocument();
    }

    for (const plugin of remote) {
      expect(queryByText(plugin.name)).toBeNull();
    }
  });

  it('should list all plugins (except core plugins) when filtering by all', async () => {
    const { queryByText } = setup('/plugins?filterBy=all?filterByType=all');

    await waitFor(() => expect(queryByText('Diagram')).toBeInTheDocument());
    for (const plugin of remote) {
      expect(queryByText(plugin.name)).toBeInTheDocument();
    }

    expect(queryByText('Alert Manager')).not.toBeInTheDocument();
  });

  it('should list installed plugins (including core plugins) when filtering by installed', async () => {
    const { queryByText } = setup('/plugins?filterBy=installed');

    await waitFor(() => queryByText('Installed'));

    for (const plugin of installed) {
      expect(queryByText(plugin.name)).toBeInTheDocument();
    }

    for (const plugin of remote) {
      expect(queryByText(plugin.name)).not.toBeInTheDocument();
    }
  });

  it('should list enterprise plugins', async () => {
    const { queryByText } = setup('/plugins?filterBy=all&q=wavefront');

    await waitFor(() => expect(queryByText('Wavefront')).toBeInTheDocument());
  });

  it('should list only datasource plugins when filtering by datasource', async () => {
    const { queryByText } = setup('/plugins?filterBy=all&filterByType=datasource');

    await waitFor(() => expect(queryByText('Wavefront')).toBeInTheDocument());

    expect(queryByText('Alert Manager')).not.toBeInTheDocument();
    expect(queryByText('Diagram')).not.toBeInTheDocument();
    expect(queryByText('Zabbix')).not.toBeInTheDocument();
  });

  it('should list only panel plugins when filtering by panel', async () => {
    const { queryByText } = setup('/plugins?filterBy=all&filterByType=panel');

    await waitFor(() => expect(queryByText('Diagram')).toBeInTheDocument());

    expect(queryByText('Wavefront')).not.toBeInTheDocument();
    expect(queryByText('Alert Manager')).not.toBeInTheDocument();
    expect(queryByText('Zabbix')).not.toBeInTheDocument();
  });

  it('should list only app plugins when filtering by app', async () => {
    const { queryByText } = setup('/plugins?filterBy=all&filterByType=app');

    await waitFor(() => expect(queryByText('Zabbix')).toBeInTheDocument());

    expect(queryByText('Wavefront')).not.toBeInTheDocument();
    expect(queryByText('Alert Manager')).not.toBeInTheDocument();
    expect(queryByText('Diagram')).not.toBeInTheDocument();
  });

  it('should only list plugins matching search', async () => {
    const { queryByText } = setup('/plugins?filterBy=all&q=zabbix');

    await waitFor(() => expect(queryByText('Zabbix')).toBeInTheDocument());

    expect(queryByText('Wavefront')).not.toBeInTheDocument();
    expect(queryByText('Alert Manager')).not.toBeInTheDocument();
    expect(queryByText('Diagram')).not.toBeInTheDocument();
  });
});

const installed: LocalPlugin[] = [
  {
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
  },
  {
    name: 'Diagram',
    type: 'panel',
    id: 'jdbranham-diagram-panel',
    enabled: true,
    pinned: false,
    info: {
      author: {
        name: 'Jeremy Branham',
        url: 'https://savantly.net',
      },
      description: 'Display diagrams and charts with colored metric indicators',
      links: [
        {
          name: 'Project site',
          url: 'https://github.com/jdbranham/grafana-diagram',
        },
        {
          name: 'Apache License',
          url: 'https://github.com/jdbranham/grafana-diagram/blob/master/LICENSE',
        },
      ],
      logos: {
        small: 'public/plugins/jdbranham-diagram-panel/img/logo.svg',
        large: 'public/plugins/jdbranham-diagram-panel/img/logo.svg',
      },
      build: {},
      version: '1.7.1',
      updated: '2021-05-26',
    },
    latestVersion: '1.7.3',
    hasUpdate: true,
    defaultNavUrl: '/plugins/jdbranham-diagram-panel/',
    category: '',
    state: '',
    signature: 'unsigned',
    signatureType: '',
    signatureOrg: '',
    dev: false,
  },
];
const remote: Plugin[] = [
  {
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
  },
  {
    createdAt: '2020-09-01T13:02:57.000Z',
    description: 'Wavefront Datasource',
    downloads: 7283,
    featured: 0,
    internal: false,
    links: [],
    name: 'Wavefront',
    orgName: 'Grafana Labs',
    orgSlug: 'grafana',
    packages: {},
    popularity: 0.0133,
    signatureType: 'grafana',
    slug: 'grafana-wavefront-datasource',
    status: 'enterprise',
    typeCode: 'datasource',
    updatedAt: '2021-06-23T12:45:13.000Z',
    version: '1.0.7',
    versionSignatureType: 'grafana',
    readme: '',
  },
];
