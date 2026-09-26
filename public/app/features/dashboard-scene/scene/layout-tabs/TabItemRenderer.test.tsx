import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { SceneTimeRange, UrlSyncContextProvider } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

async function renderTab({ title = 'Overview', key = 'tab-1' } = {}) {
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
  await act(async () => {
    render(<scene.Component model={scene} />);
  });
  return { tab, tabsLayout };
}

describe('TabItemRenderer', () => {
  it('switches normal dashboard tabs through URL synchronization', async () => {
    const tabs = new TabsLayoutManager({
      tabs: [new TabItem({ title: 'Overview' }), new TabItem({ title: 'Details' })],
    });
    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: tabs,
    });
    const { user } = await act(async () =>
      render(
        <UrlSyncContextProvider scene={scene}>
          <scene.Component model={scene} />
        </UrlSyncContextProvider>
      )
    );

    await user.click(await screen.findByRole('tab', { name: 'Details' }));

    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
    expect(new URLSearchParams(locationService.getLocation().search).get('dtab')).toBe('Details');
  });

  it('stamps data-dashboard-element-key and data-dashboard-element-type on the tab', async () => {
    await renderTab({ key: 'tab-1', title: 'Overview' });

    const tabEl = document.querySelector('[data-dashboard-element-key="tab-1"]');
    expect(tabEl).toBeInTheDocument();
    expect(tabEl).toHaveAttribute('data-dashboard-element-type', 'tab');
  });

  it('stamps the element key for a second tab', async () => {
    await renderTab({ key: 'tab-abc', title: 'Performance' });

    const tabEl = document.querySelector('[data-dashboard-element-key="tab-abc"]');
    expect(tabEl).toBeInTheDocument();
    expect(tabEl).toHaveAttribute('data-dashboard-element-type', 'tab');
  });

  it('renders the tab title in the accessible label', async () => {
    await renderTab({ title: 'Overview' });

    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
  });
});
