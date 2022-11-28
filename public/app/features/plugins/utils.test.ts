import { Location as HistoryLocation } from 'history';

import { config } from '@grafana/runtime';

import { buildPluginSectionNav } from './utils';

describe('buildPluginSectionNav', () => {
  const pluginNav = { main: { text: 'Plugin nav' }, node: { text: 'Plugin nav' } };
  const appsSection = {
    text: 'apps',
    id: 'apps',
    children: [
      {
        text: 'App1',
        children: [
          {
            text: 'page1',
            url: '/a/plugin1/page1',
          },
          {
            text: 'page2',
            url: '/a/plugin1/page2',
          },
        ],
      },
    ],
  };
  const navIndex = { apps: appsSection };

  it('Should return pluginNav if topnav is disabled', () => {
    config.featureToggles.topnav = false;
    const result = buildPluginSectionNav({} as HistoryLocation, pluginNav, {});
    expect(result).toBe(pluginNav);
  });

  it('Should return return section nav if topnav is enabled', () => {
    config.featureToggles.topnav = true;
    const result = buildPluginSectionNav({} as HistoryLocation, pluginNav, navIndex);
    expect(result?.main.text).toBe('apps');
  });

  it('Should set active page', () => {
    config.featureToggles.topnav = true;
    const result = buildPluginSectionNav(
      { pathname: '/a/plugin1/page2', search: '' } as HistoryLocation,
      null,
      navIndex
    );
    expect(result?.main.children![0].children![1].active).toBe(true);
    expect(result?.node.text).toBe('page2');
  });
});
