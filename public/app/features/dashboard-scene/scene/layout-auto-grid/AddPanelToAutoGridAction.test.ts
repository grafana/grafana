import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';

import { AddPanelToAutoGridAction } from './AddPanelToAutoGridAction';
import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

function setup(existingPanels: VizPanel[] = []) {
  const gridItems = existingPanels.map(
    (panel, index) => new AutoGridItem({ key: `grid-item-${index + 1}`, body: panel })
  );

  const manager = new AutoGridLayoutManager({
    key: 'test-AutoGridLayoutManager',
    layout: new AutoGridLayout({ children: gridItems }),
  });

  new DashboardScene({ body: manager });

  return { manager, gridItems };
}

function newPanel(key: string, title = 'Untitled') {
  return new VizPanel({ key, title, pluginId: 'table' });
}

describe('AddPanelToAutoGridAction', () => {
  describe('perform', () => {
    it('appends a grid item wrapping the panel to the layout', () => {
      const { manager } = setup();
      const panel = newPanel('incoming');
      const action = new AddPanelToAutoGridAction(manager, panel);

      action.perform();

      const children = manager.state.layout.state.children;
      expect(children).toHaveLength(1);
      expect(children[0]).toBeInstanceOf(AutoGridItem);
      expect((children[0] as AutoGridItem).state.body).toBe(panel);
    });

    it('preserves existing children', () => {
      const existing = newPanel('panel-1');
      const { manager, gridItems } = setup([existing]);
      const action = new AddPanelToAutoGridAction(manager, newPanel('incoming'));

      action.perform();

      const children = manager.state.layout.state.children;
      expect(children).toHaveLength(2);
      expect(children[0]).toBe(gridItems[0]);
    });
  });

  describe('undo', () => {
    it('removes the grid item that perform added', () => {
      const { manager } = setup();
      const action = new AddPanelToAutoGridAction(manager, newPanel('incoming'));

      action.perform();
      action.undo();

      expect(manager.state.layout.state.children).toHaveLength(0);
    });

    it('leaves existing children untouched', () => {
      const existing = newPanel('panel-1');
      const { manager, gridItems } = setup([existing]);
      const action = new AddPanelToAutoGridAction(manager, newPanel('incoming'));

      action.perform();
      action.undo();

      expect(manager.state.layout.state.children).toHaveLength(1);
      expect(manager.state.layout.state.children[0]).toBe(gridItems[0]);
    });
  });

  describe('redo (replaying perform after undo)', () => {
    it('restores the same grid item instance', () => {
      const { manager } = setup();
      const action = new AddPanelToAutoGridAction(manager, newPanel('incoming'));

      action.perform();
      const addedItem = manager.state.layout.state.children[0];
      action.undo();
      action.perform();

      expect(manager.state.layout.state.children).toHaveLength(1);
      expect(manager.state.layout.state.children[0]).toBe(addedItem);
    });

    it('survives multiple undo/redo cycles', () => {
      const { manager } = setup();
      const action = new AddPanelToAutoGridAction(manager, newPanel('incoming'));

      for (let i = 0; i < 3; i++) {
        action.perform();
        expect(manager.state.layout.state.children).toHaveLength(1);
        action.undo();
        expect(manager.state.layout.state.children).toHaveLength(0);
      }
    });
  });
});
