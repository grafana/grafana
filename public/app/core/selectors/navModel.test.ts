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

  test('get nav model for 1 level deep child', () => {
    const navModel = getNavModel(navIndex, 'apps/child1');
    expect(navModel.main.id).toBe('apps');
    expect(navModel.node.id).toBe('apps/child1');
    expect(navModel.main.children![0].active).toBe(true);
    expect(navModel.node.parentItem?.id).toBe(navModel.main.id);
  });

  test('get nav model for page 2 levels deep', () => {
    const navModel = getNavModel(navIndex, 'apps/subapp/child1');
    expect(navModel.main.id).toBe('apps');
    expect(navModel.node.id).toBe('apps/subapp/child1');
    expect(navModel.main.children![2].active).toBe(true);
    expect(navModel.main.children![2].children![0].active).toBe(true);
  });
});
