import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardEditActionEvent } from '../../edit-pane/shared';
import { DashboardScene } from '../DashboardScene';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

describe('AutoGridLayoutManager', () => {
  it('can remove panel', () => {
    const { manager, panel1 } = setup();

    manager.subscribeToEvent(DashboardEditActionEvent, (event) => {
      event.payload.perform();
    });

    manager.removePanel(panel1);

    expect(manager.state.layout.state.children.length).toBe(1);
  });
});

function setup() {
  const panel1 = new VizPanel({
    title: 'Panel A',
    key: 'panel-1',
    pluginId: 'table',
    $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
  });

  const panel2 = new VizPanel({
    title: 'Panel A',
    key: 'panel-1',
    pluginId: 'table',
    $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
  });

  const gridItems = [
    new AutoGridItem({
      key: 'grid-item-1',
      body: panel1,
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

  return { manager, panel1, panel2 };
}
