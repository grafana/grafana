import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

function renderTabs(layout: TabsLayoutManager) {
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: layout,
  });
  render(<scene.Component model={scene} />);
}

describe('TabsLayoutManagerRenderer', () => {
  it('sticks the top-level tab bar to the top of its scroll container', () => {
    renderTabs(new TabsLayoutManager({ tabs: [new TabItem({ title: 'Tab 1' })] }));

    const tablist = screen.getByRole('tablist');
    expect(tablist.parentElement).toHaveStyle({ position: 'sticky', top: '0px' });
  });

  it('does not stick a tab bar nested inside another tab, to avoid overlapping the parent bar', () => {
    const nestedTabs = new TabsLayoutManager({ tabs: [new TabItem({ title: 'Nested tab' })] });
    const outerTabs = new TabsLayoutManager({
      tabs: [new TabItem({ title: 'Outer tab', layout: nestedTabs })],
    });
    renderTabs(outerTabs);

    const tablists = screen.getAllByRole('tablist');
    expect(tablists).toHaveLength(2);
    // The outer bar (first in DOM order) should stick; the nested one must not, or it would
    // render at the same sticky offset and overlap the outer bar.
    expect(tablists[0].parentElement).toHaveStyle({ position: 'sticky' });
    expect(tablists[1].parentElement).not.toHaveStyle({ position: 'sticky' });
  });

  it('does not stick a tab bar nested inside a row inside another tab, to avoid overlapping the ancestor bar', () => {
    // Tab-in-tab is forbidden by the product, but tabs nested inside a row inside another tabs
    // layout is the supported way to nest tabs - the inner tab bar's immediate parent is a
    // RowItem, not a TabItem, so it needs its own check to avoid also sticking.
    const nestedTabs = new TabsLayoutManager({ tabs: [new TabItem({ title: 'Nested tab' })] });
    const row = new RowItem({ title: 'Row', layout: nestedTabs });
    const outerTabs = new TabsLayoutManager({
      tabs: [new TabItem({ title: 'Outer tab', layout: new RowsLayoutManager({ rows: [row] }) })],
    });
    renderTabs(outerTabs);

    const tablists = screen.getAllByRole('tablist');
    expect(tablists).toHaveLength(2);
    expect(tablists[0].parentElement).toHaveStyle({ position: 'sticky' });
    expect(tablists[1].parentElement).not.toHaveStyle({ position: 'sticky' });
  });

  it('does not stick a tab bar nested inside a row of the dashboard\'s root Rows layout', () => {
    // Dashboard > Rows > Row > Tabs: the root layout here is Rows, not Tabs, so there is no
    // ancestor tabs bar to overlap - but the nested tab bar still isn't the dashboard's root
    // layout, so it shouldn't stick either. Otherwise it would stay pinned to the top of the
    // viewport even after scrolling well past the row it belongs to.
    const nestedTabs = new TabsLayoutManager({ tabs: [new TabItem({ title: 'Nested tab' })] });
    const row = new RowItem({ title: 'Row', layout: nestedTabs });
    const rootRows = new RowsLayoutManager({ rows: [row] });

    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: rootRows,
    });
    render(<scene.Component model={scene} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist.parentElement).not.toHaveStyle({ position: 'sticky' });
  });
});
