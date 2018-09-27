import { Plugin } from 'app/types';

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
        screenshots: `screenshot/${i}`,
        updated: '2018-09-26',
        version: '1',
      },
      latestVersion: `1.${i}`,
      name: `pretty cool plugin-${i}`,
      pinned: false,
      state: '',
      type: '',
    });
  }

  return plugins;
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
      links: ['one link'],
      logos: { small: 'small/logo', large: 'large/logo' },
      screenshots: 'screenshot/1',
      updated: '2018-09-26',
      version: '1',
    },
    latestVersion: '1',
    name: 'pretty cool plugin 1',
    pinned: false,
    state: '',
    type: '',
  };
};
