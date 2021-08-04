import React from 'react';
import { Router } from 'react-router-dom';
import { render, RenderResult, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { locationService } from '@grafana/runtime';
import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
import BrowsePage from './Browse';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { configureStore } from 'app/store/configureStore';
import { LocalPlugin, RemotePlugin, PluginAdminRoutes } from '../types';
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
}

describe('Browse list of plugins', () => {
  describe('when filtering', () => {
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
      const { queryByText } = setup('/plugins?filterBy=all&filterByType=all');

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
      expect(queryByText('ACE.SVG')).not.toBeInTheDocument();
    });

    it('should list only panel plugins when filtering by panel', async () => {
      const { queryByText } = setup('/plugins?filterBy=all&filterByType=panel');

      await waitFor(() => expect(queryByText('Diagram')).toBeInTheDocument());
      expect(queryByText('ACE.SVG')).toBeInTheDocument();

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
      expect(queryByText('ACE.SVG')).not.toBeInTheDocument();
    });
  });
  describe('when searching', () => {
    it('should only list plugins matching search', async () => {
      const { queryByText } = setup('/plugins?filterBy=all&q=zabbix');

      await waitFor(() => expect(queryByText('Zabbix')).toBeInTheDocument());

      expect(queryByText('Wavefront')).not.toBeInTheDocument();
      expect(queryByText('Alert Manager')).not.toBeInTheDocument();
      expect(queryByText('Diagram')).not.toBeInTheDocument();
      expect(queryByText('Redis Application')).not.toBeInTheDocument();
    });
  });

  describe('when sorting', () => {
    it('should sort plugins by name in ascending alphabetical order', async () => {
      const { findByTestId } = setup('/plugins?filterBy=all');

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
      const { findByTestId } = setup('/plugins?filterBy=all&sortBy=nameDesc');

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
      const { findByTestId } = setup('/plugins?filterBy=all&sortBy=updated');

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
      const { findByTestId } = setup('/plugins?filterBy=all&sortBy=published');

      const pluginList = await findByTestId('plugin-list');
      const pluginHeadings = within(pluginList).queryAllByRole('heading');

      expect(pluginHeadings.map((heading) => heading.innerHTML)).toStrictEqual([
        'Diagram',
        'Redis Application',
        'ACE.SVG',
        'Wavefront',
        'Zabbix',
      ]);
    });

    it('should sort plugins by number of downloads in ascending order', async () => {
      const { findByTestId } = setup('/plugins?filterBy=all&sortBy=downloads');

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
});

const installed: LocalPlugin[] = [
  {
    name: 'Alert Manager',
    type: PluginType.datasource,
    id: 'alertmanager',
    enabled: true,
    pinned: false,
    info: {
      author: {
        name: 'Prometheus alertmanager',
        url: 'https://grafana.com',
      },
      description: '',
      links: [
        {
          name: 'Learn more',
          url: 'https://prometheus.io/docs/alerting/latest/alertmanager/',
        },
      ],
      logos: {
        small: 'public/app/plugins/datasource/alertmanager/img/logo.svg',
        large: 'public/app/plugins/datasource/alertmanager/img/logo.svg',
      },
      build: {},
      screenshots: null,
      version: '',
      updated: '',
    },
    latestVersion: '',
    hasUpdate: false,
    defaultNavUrl: '/plugins/alertmanager/',
    category: '',
    state: 'alpha',
    signature: PluginSignatureStatus.internal,
    signatureType: '',
    signatureOrg: '',
  },
  {
    name: 'Diagram',
    type: PluginType.panel,
    id: 'jdbranham-diagram-panel',
    enabled: true,
    pinned: false,
    info: {
      author: { name: 'Jeremy Branham', url: 'https://savantly.net' },
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
      screenshots: [],
      version: '1.7.3',
      updated: '2021-07-20',
    },
    latestVersion: '1.7.3',
    hasUpdate: true,
    defaultNavUrl: '/plugins/jdbranham-diagram-panel/',
    category: '',
    state: '',
    signature: PluginSignatureStatus.missing,
    signatureType: '',
    signatureOrg: '',
  },
  {
    name: 'Redis Application',
    type: PluginType.app,
    id: 'redis-app',
    enabled: false,
    pinned: false,
    info: {
      author: {
        name: 'RedisGrafana',
        url: 'https://redisgrafana.github.io',
      },
      description: 'Provides Application pages and custom panels for Redis Data Source.',
      links: [
        { name: 'Website', url: 'https://redisgrafana.github.io' },
        {
          name: 'License',
          url: 'https://github.com/RedisGrafana/grafana-redis-app/blob/master/LICENSE',
        },
      ],
      logos: {
        small: 'public/plugins/redis-app/img/logo.svg',
        large: 'public/plugins/redis-app/img/logo.svg',
      },
      build: {},
      screenshots: [],
      version: '2.0.1',
      updated: '2021-07-07',
    },
    latestVersion: '2.0.1',
    hasUpdate: false,
    defaultNavUrl: '/plugins/redis-app/',
    category: '',
    state: '',
    signature: PluginSignatureStatus.valid,
    signatureType: PluginSignatureType.commercial,
    signatureOrg: 'RedisGrafana',
  },
];

const remote: RemotePlugin[] = [
  {
    status: 'active',
    id: 74,
    typeId: 1,
    typeName: 'Application',
    typeCode: PluginType.app,
    slug: 'alexanderzobnin-zabbix-app',
    name: 'Zabbix',
    description: 'Zabbix plugin for Grafana',
    version: '4.1.5',
    versionStatus: 'active',
    versionSignatureType: PluginSignatureType.community,
    versionSignedByOrg: 'alexanderzobnin',
    versionSignedByOrgName: 'Alexander Zobnin',
    userId: 0,
    orgId: 13056,
    orgName: 'Alexander Zobnin',
    orgSlug: 'alexanderzobnin',
    orgUrl: 'https://github.com/alexanderzobnin',
    url: 'https://github.com/alexanderzobnin/grafana-zabbix',
    createdAt: '2016-04-06T20:23:41.000Z',
    updatedAt: '2021-05-18T14:53:01.000Z',
    downloads: 34387994,
    verified: false,
    featured: 180,
    internal: false,
    downloadSlug: 'alexanderzobnin-zabbix-app',
    popularity: 0.2019,
    signatureType: PluginSignatureType.community,
    packages: {},
    links: [],
  },
  {
    status: 'enterprise',
    id: 658,
    typeId: 2,
    typeName: 'Data Source',
    typeCode: PluginType.datasource,
    slug: 'grafana-wavefront-datasource',
    name: 'Wavefront',
    description: 'Wavefront Datasource',
    version: '1.0.8',
    versionStatus: 'active',
    versionSignatureType: PluginSignatureType.grafana,
    versionSignedByOrg: 'grafana',
    versionSignedByOrgName: 'Grafana Labs',
    userId: 0,
    orgId: 5000,
    orgName: 'Grafana Labs',
    orgSlug: 'grafana',
    orgUrl: 'https://grafana.org',
    url: 'https://github.com/grafana/wavefront-datasource/',
    createdAt: '2020-09-01T13:02:57.000Z',
    updatedAt: '2021-07-12T18:41:03.000Z',
    downloads: 7818,
    verified: false,
    featured: 0,
    internal: false,
    downloadSlug: 'grafana-wavefront-datasource',
    popularity: 0.0107,
    signatureType: PluginSignatureType.grafana,
    packages: {},
    links: [],
  },
  {
    status: 'active',
    id: 659,
    typeId: 3,
    typeName: 'Panel',
    typeCode: PluginType.panel,
    slug: 'aceiot-svg-panel',
    name: 'ACE.SVG',
    description: 'SVG Visualization Panel',
    version: '0.0.10',
    versionStatus: 'active',
    versionSignatureType: PluginSignatureType.community,
    versionSignedByOrg: 'aceiot',
    versionSignedByOrgName: 'Andrew Rodgers',
    userId: 0,
    orgId: 409764,
    orgName: 'Andrew Rodgers',
    orgSlug: 'aceiot',
    orgUrl: '',
    url: 'https://github.com/ACE-IoT-Solutions/ace-svg-react',
    createdAt: '2020-09-01T14:46:44.000Z',
    updatedAt: '2021-06-28T14:01:36.000Z',
    downloads: 101569,
    verified: false,
    featured: 0,
    internal: false,
    downloadSlug: 'aceiot-svg-panel',
    popularity: 0.0134,
    signatureType: PluginSignatureType.community,
    packages: {},
    links: [],
  },
];
