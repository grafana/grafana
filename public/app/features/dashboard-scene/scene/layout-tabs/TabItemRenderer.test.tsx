import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { SceneTimeRange } from '@grafana/scenes';

import { DashboardAnnotationsDataLayer } from '../DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../DashboardDataLayerSet';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({}),
    getList: jest.fn(),
    getInstanceSettings: jest.fn(),
    reload: jest.fn(),
  })),
}));

async function renderTab({
  title = 'Overview',
  key = 'tab-1',
  $data,
}: {
  title?: string;
  key?: string;
  $data?: DashboardDataLayerSet;
} = {}) {
  const tab = new TabItem({
    key,
    title,
    layout: AutoGridLayoutManager.createEmpty(),
    $data,
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

  it('renders a tab annotation control on the tab', async () => {
    await renderTab({
      $data: new DashboardDataLayerSet({
        annotationLayers: [
          new DashboardAnnotationsDataLayer({
            name: 'Deploys',
            isEnabled: true,
            isHidden: false,
            query: { name: 'Deploys', enable: true, iconColor: 'red' },
          }),
        ],
      }),
    });

    expect(screen.getByText('Deploys')).toBeInTheDocument();
  });
});
