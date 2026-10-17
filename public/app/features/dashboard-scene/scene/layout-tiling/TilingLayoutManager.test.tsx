import { VizPanel } from '@grafana/scenes';

import { DashboardEditActionEvent } from '../../sidebar/events';
import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { TilingLayoutManager } from './TilingLayoutManager';

function buildPanel(id: number, title = `Panel ${id}`) {
  return new VizPanel({ key: `panel-${id}`, title, pluginId: 'timeseries' });
}

function setup(panels: VizPanel[] = []) {
  const manager = new TilingLayoutManager({ panels });
  const scene = new DashboardScene({ body: manager });
  const undoers: Array<() => void> = [];

  manager.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => {
    payload.perform();
    undoers.push(payload.undo);
  });

  return { manager, scene, undo: () => undoers.pop()?.() };
}

function getDockedViewIds(manager: TilingLayoutManager): string[] {
  const ids: string[] = [];
  const walk = (node: NonNullable<TilingLayoutManager['state']['document']['root']>) => {
    if (node.kind === 'panel') {
      ids.push(...node.views);
    } else {
      node.children.forEach(walk);
    }
  };
  const { root } = manager.state.document;
  if (root) {
    walk(root);
  }
  return ids;
}

describe('TilingLayoutManager', () => {
  it('adds panels to a flat list and docks a view for each of them', () => {
    const { manager } = setup();

    manager.addPanel(buildPanel(1));
    manager.addPanel(buildPanel(2));
    manager.addPanel(buildPanel(3));

    const { panels, document } = manager.state;
    expect(panels.map((p) => p.state.key)).toEqual(['panel-1', 'panel-2', 'panel-3']);
    expect(getDockedViewIds(manager).sort()).toEqual(['panel-1', 'panel-2', 'panel-3']);
    expect(document.views['panel-2']).toEqual({ title: 'Panel 2', type: 'viz' });
    expect(manager.getVizPanels()).toBe(panels);
  });

  it('removes the panel and its view', () => {
    const { manager } = setup();
    manager.addPanel(buildPanel(1));
    manager.addPanel(buildPanel(2));

    manager.removePanel(manager.state.panels[0]);

    expect(manager.state.panels.map((p) => p.state.key)).toEqual(['panel-2']);
    expect(getDockedViewIds(manager)).toEqual(['panel-2']);
    expect(manager.state.document.views['panel-1']).toBeUndefined();
  });

  it('restores the panel and its view when a removal is undone', () => {
    const { manager, undo } = setup();
    manager.addPanel(buildPanel(1));
    manager.addPanel(buildPanel(2));

    manager.removePanel(manager.state.panels[0]);
    undo();

    expect(manager.state.panels.map((p) => p.state.key)).toEqual(['panel-1', 'panel-2']);
    expect(getDockedViewIds(manager).sort()).toEqual(['panel-1', 'panel-2']);
  });

  it('creates a document with a view per panel when converting from another layout', () => {
    const { scene } = setup();
    const source = DefaultGridLayoutManager.fromVizPanels([buildPanel(1), buildPanel(2), buildPanel(3)]);
    scene.setState({ body: source });

    const manager = TilingLayoutManager.createFromLayout(source);

    expect(manager.state.panels.map((p) => p.state.key)).toEqual(['panel-1', 'panel-2', 'panel-3']);
    expect(getDockedViewIds(manager).sort()).toEqual(['panel-1', 'panel-2', 'panel-3']);
  });

  it('serializes the panels as an auto grid, as the tiling arrangement has no schema', () => {
    const { manager } = setup();
    manager.addPanel(buildPanel(1));
    manager.addPanel(buildPanel(2));

    const layout = manager.serialize();

    expect(layout.kind).toBe('AutoGridLayout');
    if (layout.kind === 'AutoGridLayout') {
      expect(layout.spec.items.map((item) => item.spec.element.name)).toEqual(['panel-1', 'panel-2']);
    }
  });

  it('re-keys the views of a duplicate', () => {
    const { manager } = setup();
    manager.addPanel(buildPanel(1));
    manager.addPanel(buildPanel(2));
    let nextId = 10;

    const duplicate = manager.duplicate(() => nextId++) as TilingLayoutManager;

    expect(duplicate.state.panels.map((p) => p.state.key)).toEqual(['panel-10', 'panel-11']);
    expect(getDockedViewIds(duplicate).sort()).toEqual(['panel-10', 'panel-11']);
    expect(Object.keys(duplicate.state.document.views).sort()).toEqual(['panel-10', 'panel-11']);
  });
});
