import { NavModelItem } from '@grafana/data';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';

import { buildPluginSectionNav } from './utils';

describe('buildPluginSectionNav', () => {
  const app1: NavModelItem = {
    text: 'App1',
    id: 'plugin-page-app1',
    url: '/a/plugin1',
    children: [
      {
        text: 'page1',
        url: '/a/plugin1/page1',
      },
      {
        text: 'page2',
        url: '/a/plugin1/page2',
      },
      {
        text: 'page3',
        url: '/a/plugin1/page3',
        children: [
          {
            text: 'page4',
            url: '/a/plugin1/page3/page4',
          },
        ],
      },
    ],
  };

  const appsSection = {
    text: 'apps',
    id: 'apps',
    children: [app1],
  };

  const home = {
    id: HOME_NAV_ID,
    text: 'Home',
  };

  const adminSection: NavModelItem = {
    text: 'Admin',
    id: 'admin',
    children: [],
    parentItem: home,
  };

  const standalonePluginPage = {
    id: 'standalone-plugin-page-/a/app2/config',
    text: 'Standalone page',
    parentItem: adminSection,
  };

  adminSection.children = [standalonePluginPage];

  app1.parentItem = appsSection;

  it('Should return return section nav', () => {
    const result = buildPluginSectionNav('/a/plugin1/page1', appsSection);
    expect(result?.main.text).toBe('apps');
  });

  it('Should set active page', () => {
    const result = buildPluginSectionNav('/a/plugin1/page2', appsSection);
    expect(result?.main.children![0].children![1].active).toBe(true);
    expect(result?.node.text).toBe('page2');
  });

  it('Should only set the most specific match as active (not the parents)', () => {
    const result = buildPluginSectionNav('/a/plugin1/page2', appsSection);
    expect(result?.main.children![0].children![1].active).toBe(true);
    expect(result?.main.children![0].active).not.toBe(true); // Parent should not be active
  });

  it('Should set app section to active', () => {
    const result = buildPluginSectionNav('/a/plugin1', appsSection);
    expect(result?.main.children![0].active).toBe(true);
    expect(result?.node.text).toBe('App1');
  });

  it('Should handle standalone page', () => {
    const result = buildPluginSectionNav('/a/app2/config', adminSection);
    expect(result?.main.text).toBe('Admin');
    expect(result?.node.text).toBe('Standalone page');
  });

  it('Should set nested active page', () => {
    const result = buildPluginSectionNav('/a/plugin1/page3/page4', appsSection);
    expect(result?.main.children![0].children![2].children![0].active).toBe(true);
    expect(result?.node.text).toBe('page4');
  });
});
