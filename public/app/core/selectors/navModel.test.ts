import { config } from '@grafana/runtime';

import { buildInitialState } from '../reducers/navModel';

import { getNavModel } from './navModel';

describe('getNavModel', () => {
  config.bootData.navTree = [
    {
      text: 'Apps',
      id: 'apps',
      url: 'apps',
      children: [
        { text: '', id: 'apps/child1', url: 'apps/child1' },
        { text: '', id: 'apps/child2', url: 'apps/child2' },
        {
          text: '',
          id: 'apps/subapp',
          url: 'section/subapp',
          children: [
            { text: '', id: 'apps/subapp/child1', url: 'apps/subapp/child1' },
            { text: '', id: 'apps/subapp/child2', url: 'apps/subapp/child2' },
          ],
        },
      ],
    },
  ];

  const navIndex = buildInitialState();

  test('returns the correct nav model for root node', () => {
    const navModel = getNavModel(navIndex, 'apps');
    expect(navModel.main.id).toBe('apps');
    expect(navModel.node.id).toBe('apps');
  });

  test('returns the correct nav model a 1st-level child', () => {
    const navModel = getNavModel(navIndex, 'apps/child1');
    expect(navModel.main.id).toBe('apps');
    expect(navModel.node.id).toBe('apps/child1');
    expect(navModel.main.children![0].active).toBe(true);
    expect(navModel.node.parentItem?.id).toBe(navModel.main.id);
  });

  test('returns the correct nav model for a 2nd-level child', () => {
    const navModel = getNavModel(navIndex, 'apps/subapp/child1');
    expect(navModel.main.id).toBe('apps');
    expect(navModel.node.id).toBe('apps/subapp/child1');
    expect(navModel.main.children![2].active).toBe(undefined);
    expect(navModel.main.children![2].children![0].active).toBe(true);
  });

  test('returns fallback nav model when provided for non-existent node', () => {
    const fallbackNavModel = {
      main: { id: 'fallback-main', text: 'Fallback Main', url: '/fallback' },
      node: { id: 'fallback-node', text: 'Fallback Node', url: '/fallback/node' },
    };

    const navModel = getNavModel(navIndex, 'non-existent-id', fallbackNavModel);
    expect(navModel).toBe(fallbackNavModel);
    expect(navModel.main.id).toBe('fallback-main');
    expect(navModel.node.id).toBe('fallback-node');
  });

  test('returns not found nav model when no fallback provided for non-existent node', () => {
    const navModel = getNavModel(navIndex, 'non-existent-id');
    expect(navModel.main.id).toBe('not-found');
    expect(navModel.node.id).toBe('not-found');
    expect(navModel.main.text).toBe('Page not found');
    expect(navModel.main.subTitle).toBe('404 Error');
    expect(navModel.main.icon).toBe('exclamation-triangle');
    expect(navModel.main.url).toBe('not-found');
  });
});
