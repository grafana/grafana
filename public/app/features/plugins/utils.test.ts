import { Location as HistoryLocation } from 'history';

import { NavIndex, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { buildPluginSectionNav } from './utils';

describe('buildPluginSectionNav', () => {
  const pluginNav = { main: { text: 'Plugin nav' }, node: { text: 'Plugin nav' } };
  const app1: NavModelItem = {
    text: 'App1',
    id: 'plugin-page-app1',
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
  };
  const appsSection = {
    text: 'apps',
    id: 'apps',
    children: [app1],
  };

  app1.parentItem = appsSection;

  const navIndex: NavIndex = {
    apps: appsSection,
    [app1.id!]: appsSection.children[0],
  };

  it('Should return pluginNav if topnav is disabled', () => {
    config.featureToggles.topnav = false;
    const result = buildPluginSectionNav({} as HistoryLocation, pluginNav, {}, 'app1');
    expect(result).toBe(pluginNav);
  });

  it('Should return return section nav if topnav is enabled', () => {
    config.featureToggles.topnav = true;
    const result = buildPluginSectionNav({} as HistoryLocation, pluginNav, navIndex, 'app1');
    expect(result?.main.text).toBe('apps');
  });

  it('Should set active page', () => {
    config.featureToggles.topnav = true;
    const result = buildPluginSectionNav(
      { pathname: '/a/plugin1/page2', search: '' } as HistoryLocation,
      null,
      navIndex,
      'app1'
    );
    expect(result?.main.children![0].children![1].active).toBe(true);
    expect(result?.node.text).toBe('page2');
  });
});
