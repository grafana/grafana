import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardEditActionEvent } from '../../edit-pane/shared';
import { DashboardScene } from '../DashboardScene';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

describe('AutoGridLayoutManager', () => {
  describe('removePanel', () => {
    it('can remove panel', () => {
      const { manager, panel1 } = setup();

      manager.subscribeToEvent(DashboardEditActionEvent, (event) => {
        event.payload.perform();
      });

      manager.removePanel(panel1);

      expect(manager.state.layout.state.children.length).toBe(1);
    });
  });

  describe('duplicate', () => {
    it('returns a new AutoGridLayoutManager instance', () => {
      const { manager } = setup();

      const duplicated = manager.duplicate() as AutoGridLayoutManager;

      expect(duplicated).toBeInstanceOf(AutoGridLayoutManager);
      expect(duplicated).not.toBe(manager);
      expect(duplicated.state.key).not.toBe(manager.state.key);
    });

    it('deep-clones all children', () => {
      const { manager, gridItems } = setup();

      const duplicated = manager.duplicate() as AutoGridLayoutManager;

      const clonedChildren = duplicated.state.layout.state.children;

      expect(clonedChildren.length).toBe(2);

      expect(clonedChildren[0]).not.toBe(gridItems[0]);
      expect(clonedChildren[0].state.body).not.toBe(gridItems[0].state.body);

      expect(clonedChildren[1]).not.toBe(gridItems[1]);
      expect(clonedChildren[1].state.body).not.toBe(gridItems[1].state.body);
    });

    describe('when grid items contain panels', () => {
      it('assigns unique sequential panel keys, starting after the highest existing id', () => {
        const { manager } = setup();

        const duplicated = manager.duplicate() as AutoGridLayoutManager;

        const panelKeys = duplicated.getVizPanels().map((p) => p.state.key);
        expect(panelKeys).toEqual(['panel-3', 'panel-4']);
      });
    });
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
    key: 'panel-2',
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

  const manager = new AutoGridLayoutManager({
    key: 'test-AutoGridLayoutManager',
    layout: new AutoGridLayout({ children: gridItems }),
  });

  new DashboardScene({ body: manager });

  return { manager, gridItems, panel1, panel2 };
}
