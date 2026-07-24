import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, SceneGridLayout, SceneTimeRange, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const INTERCEPT_LABEL = 'Panel sizes are managed by auto layout';

function getInterceptors() {
  return screen.queryAllByRole('button', { name: INTERCEPT_LABEL });
}

// Panels load their plugin asynchronously and update state on resolve; flush that inside act()
// so the pending update doesn't leak out of the test.
async function flushPanelLoad() {
  await act(async () => {});
}

describe('AutoGridResizeIntercept', () => {
  it('renders only for the source panel, not for repeated panels', async () => {
    const panel = new VizPanel({ title: 'Panel 1', key: 'panel-1', pluginId: 'table' });

    const gridItem = new AutoGridItem({
      key: 'grid-item-1',
      body: panel,
      variableName: 'values',
    });

    const scene = new DashboardScene({
      isEditing: true,
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      $variables: new SceneVariableSet({
        variables: [
          new CustomVariable({
            name: 'values',
            query: 'A,B,C',
            options: [
              { label: 'A', value: 'A' },
              { label: 'B', value: 'B' },
              { label: 'C', value: 'C' },
            ],
            value: ['A', 'B', 'C'],
            text: ['A', 'B', 'C'],
            isMulti: true,
          }),
        ],
      }),
      body: new AutoGridLayoutManager({
        key: 'test-AutoGridLayoutManager',
        layout: new AutoGridLayout({ children: [gridItem] }),
      }),
    });

    render(<scene.Component model={scene} />);
    await flushPanelLoad();

    // The repeat produces one source panel plus two repeated clones, but only the source panel
    // gets the resize interceptor.
    expect(gridItem.state.repeatedPanels).toHaveLength(2);
    expect(getInterceptors()).toHaveLength(1);
  });

  it('renders in auto layout but not in a custom (default) grid layout', async () => {
    const autoScene = new DashboardScene({
      isEditing: true,
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: new AutoGridLayoutManager({
        key: 'auto-grid',
        layout: new AutoGridLayout({
          children: [
            new AutoGridItem({ key: 'grid-item-1', body: new VizPanel({ key: 'panel-1', pluginId: 'table' }) }),
          ],
        }),
      }),
    });

    const { unmount } = render(<autoScene.Component model={autoScene} />);
    await flushPanelLoad();
    expect(getInterceptors()).toHaveLength(1);
    unmount();

    const customScene = new DashboardScene({
      isEditing: true,
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [
            new DashboardGridItem({
              key: 'gi-1',
              x: 0,
              y: 0,
              width: 8,
              height: 6,
              body: new VizPanel({ key: 'panel-1', pluginId: 'table' }),
            }),
          ],
        }),
      }),
    });

    render(<customScene.Component model={customScene} />);
    await flushPanelLoad();
    expect(getInterceptors()).toHaveLength(0);
  });
});
