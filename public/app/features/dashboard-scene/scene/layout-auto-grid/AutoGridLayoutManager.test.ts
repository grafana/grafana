import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { findVizPanelByKey } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

describe('AutoGridLayoutManager', () => {
  it('Should clone the layout', () => {
    const { manager } = setup();
    const clone = manager.cloneLayout('foo', true) as AutoGridLayoutManager;

    expect(clone).not.toBe(manager);
    expect(clone.state.layout).not.toBe(manager.state.layout);
    expect(clone.state.layout.state.children).not.toBe(manager.state.layout.state.children);
    expect(clone.state.layout.state.children.length).toBe(manager.state.layout.state.children.length);

    const panelA = findVizPanelByKey(clone, 'foo/grid-item-1/panel-1');
    expect(panelA?.state.title).toBe('Panel A');

    const panelB = findVizPanelByKey(clone, 'foo/grid-item-2/panel-2');
    expect(panelB?.state.title).toBe('Panel B');
  });
});

function setup() {
  const gridItems = [
    new AutoGridItem({
      key: 'grid-item-1',
      body: new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
      }),
    }),
    new AutoGridItem({
      key: 'grid-item-2',
      body: new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    }),
  ];

  const manager = new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: gridItems }) });

  new DashboardScene({ body: manager });

  return { manager };
}
