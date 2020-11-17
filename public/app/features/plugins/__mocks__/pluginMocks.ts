import { defaultsDeep } from 'lodash';
import { PanelPluginMeta, PluginMeta, PluginType, PanelPlugin, PanelProps } from '@grafana/data';
import { ComponentType } from 'enzyme';

export const getMockPlugins = (amount: number): PluginMeta[] => {
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

  return plugins as any;
};

export function getPanelPlugin(
  options: Partial<PanelPluginMeta>,
  reactPanel?: ComponentType<PanelProps>,
  angularPanel?: any
): PanelPlugin {
  const plugin = new PanelPlugin(reactPanel!);
  plugin.angularPanelCtrl = angularPanel;
  plugin.meta = {
    id: options.id!,
    type: PluginType.panel,
    name: options.id!,
    sort: options.sort || 1,
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
  };
  return plugin;
}

export function getMockPlugin(overrides?: Partial<PluginMeta>): PluginMeta {
  const defaults: PluginMeta = {
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
      screenshots: [{ path: `screenshot`, name: 'test' }],
      updated: '2018-09-26',
      version: '1',
    },
    latestVersion: '1',
    name: 'pretty cool plugin 1',
    baseUrl: 'path/to/plugin',
    pinned: false,
    type: PluginType.panel,
    module: 'path/to/module',
  };

  return defaultsDeep(overrides || {}, defaults) as PluginMeta;
}
