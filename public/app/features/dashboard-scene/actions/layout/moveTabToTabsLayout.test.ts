import { DashboardScene } from '../../scene/DashboardScene';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { moveTabToTabsLayout } from './moveTabToTabsLayout';

describe('moveTabToTabsLayout', () => {
  let deactivate: () => void;
  afterEach(() => deactivate?.());

  it('inserts the tab at the given position and opens it there, and undo restores both tab bars', () => {
    const inner1 = new TabItem({ title: 'Inner 1' });
    const inner2 = new TabItem({ title: 'Inner 2' });
    const nested = new TabsLayoutManager({ tabs: [inner1, inner2], currentTabSlug: inner2.getSlug() });
    const outerA = new TabItem({ title: 'Outer A', layout: nested });
    const outerB = new TabItem({ title: 'Outer B' });
    const outer = new TabsLayoutManager({ tabs: [outerA, outerB], currentTabSlug: outerA.getSlug() });
    const dashboard = new DashboardScene({ isEditing: true, body: outer });
    deactivate = activateFullSceneTree(dashboard);
    const sidebar = dashboard.state.sidebar;

    moveTabToTabsLayout({ tab: inner2, source: nested, destination: outer, index: 1 });
    const expectMoved = () => {
      expect(titles(outer)).toEqual(['Outer A', 'Inner 2', 'Outer B']);
      expect(inner2.parent).toBe(outer);
      expect(outer.getCurrentTab()).toBe(inner2);
      // The moved tab was open in its source, so the tab before it opens there
      expect(titles(nested)).toEqual(['Inner 1']);
      expect(nested.getCurrentTab()).toBe(inner1);
    };
    expectMoved();
    expect(sidebar.state.undoStack).toHaveLength(1);

    sidebar.undoAction();
    expect(titles(outer)).toEqual(['Outer A', 'Outer B']);
    expect(outer.getCurrentTab()).toBe(outerA);
    expect(titles(nested)).toEqual(['Inner 1', 'Inner 2']);
    expect(nested.getCurrentTab()).toBe(inner2);
    expect(inner2.parent).toBe(nested);

    sidebar.redoAction();
    expectMoved();
  });
});

function titles(layout: TabsLayoutManager) {
  return layout.state.tabs.map((tab) => tab.state.title);
}
