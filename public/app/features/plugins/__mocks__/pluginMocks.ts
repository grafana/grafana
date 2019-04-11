import { Plugin, PanelPlugin, PanelDataFormat } from 'app/types';
import { PluginType } from '@grafana/ui';

export const getMockPlugins = (amount: number): Plugin[] => {
  const plugins = [];

  for (let i = 0; i <= amount; i++) {
    plugins.push({
      defaultNavUrl: 'some/url',
      enabled: false,
      hasUpdate: false,
      id: `${i}`,
      info: {
        author: {
          name: 'Grafana Labs',
          url: 'url/to/GrafanaLabs',
        },
        description: 'pretty decent plugin',
        links: ['one link'],
        logos: { small: 'small/logo', large: 'large/logo' },
        screenshots: [{ path: `screenshot/${i}` }],
        updated: '2018-09-26',
        version: '1',
      },
      latestVersion: `1.${i}`,
      name: `pretty cool plugin-${i}`,
      pinned: false,
      state: '',
      type: '',
      module: {},
    });
  }

  return plugins;
};

export const getPanelPlugin = (options: Partial<PanelPlugin>): PanelPlugin => {
  return {
    id: options.id,
    type: PluginType.panel,
    name: options.id,
    sort: options.sort || 1,
    dataFormats: [PanelDataFormat.TimeSeries],
    info: {
      author: {
        name: options.id + 'name',
      },
      description: '',
      links: [],
      logos: {
        large: '',
        small: '',
      },
      screenshots: [],
      updated: '',
      version: '',
    },
    hideFromList: options.hideFromList === true,
    module: '',
    baseUrl: '',
    reactPlugin: options.reactPlugin,
    angularPlugin: options.angularPlugin,
  };
};

export const getMockPlugin = () => {
  return {
    defaultNavUrl: 'some/url',
    enabled: false,
    hasUpdate: false,
    id: '1',
    info: {
      author: {
        name: 'Grafana Labs',
        url: 'url/to/GrafanaLabs',
      },
      description: 'pretty decent plugin',
      links: [{ name: 'project', url: 'one link' }],
      logos: { small: 'small/logo', large: 'large/logo' },
      screenshots: [{ path: `screenshot` }],
      updated: '2018-09-26',
      version: '1',
    },
    latestVersion: '1',
    name: 'pretty cool plugin 1',
    baseUrl: 'path/to/plugin',
    pinned: false,
    type: PluginType.panel,
    module: 'path/to/module',
  } as Plugin;
};
