import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

function renderTab({ title = 'Overview', key = 'tab-1' } = {}) {
  const tab = new TabItem({
    key,
    title,
    layout: AutoGridLayoutManager.createEmpty(),
  });
  const tabsLayout = new TabsLayoutManager({ key: 'tabs-layout', tabs: [tab] });
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: tabsLayout,
  });
  render(<scene.Component model={scene} />);
  return { tab, tabsLayout };
}

describe('TabItemRenderer', () => {
  it('stamps data-dashboard-element-key and data-dashboard-element-type on the tab', () => {
    renderTab({ key: 'tab-1', title: 'Overview' });

    const tabEl = document.querySelector('[data-dashboard-element-key="tab-1"]');
    expect(tabEl).toBeInTheDocument();
    expect(tabEl).toHaveAttribute('data-dashboard-element-type', 'tab');
  });

  it('stamps the element key for a second tab', () => {
    renderTab({ key: 'tab-abc', title: 'Performance' });

    const tabEl = document.querySelector('[data-dashboard-element-key="tab-abc"]');
    expect(tabEl).toBeInTheDocument();
    expect(tabEl).toHaveAttribute('data-dashboard-element-type', 'tab');
  });

  it('renders the tab title in the accessible label', () => {
    renderTab({ title: 'Overview' });

    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
  });
});
