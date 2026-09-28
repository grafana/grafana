import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import type { PanelProps } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, SceneGridLayout, SceneTimeRange, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';
import { interceptorTestId } from './AutoGridResizeIntercept';

function TestVizPanel(props: PanelProps) {
  return <div>{props.title}</div>;
}

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({ id: 'table' }, TestVizPanel)),
  getPanelPluginFromCache: () => undefined,
});

function getInterceptors() {
  return screen.queryAllByTestId(interceptorTestId);
}

function getPanelContainer(title: string) {
  return screen.getByText(title).closest('div[id]');
}

// Panels load their plugin asynchronously and update state on resolve; flush that inside act()
// so the pending update doesn't leak out of the test.
async function flushPanelLoad() {
  await act(async () => {});
}

describe('AutoGridResizeIntercept', () => {
  it('renders for a panel that does not repeat', async () => {
    await buildAutoGridScene({ repeat: false });
    expect(getInterceptors()).toHaveLength(1);
  });

  it('it renders only for the last repeated panel', async () => {
    const { gridItem } = await buildAutoGridScene();

    // The repeat produces one source panel plus two repeated clones, but only the last panel
    // gets the resize interceptor.
    expect(gridItem.state.repeatedPanels).toHaveLength(2);

    const [interceptor] = getInterceptors();
    const firstPanel = getPanelContainer('Panel A');
    const middlePanel = getPanelContainer('Panel B');
    const lastPanel = getPanelContainer('Panel C');

    expect(interceptor).toBeInTheDocument();
    expect(firstPanel).not.toContainElement(interceptor);
    expect(middlePanel).not.toContainElement(interceptor);
    expect(lastPanel).toContainElement(interceptor);
  });

  it('renders in auto layout but not in a custom (default) grid layout', async () => {
    const { unmount } = await buildAutoGridScene();
    expect(getInterceptors()).toHaveLength(1);
    unmount();

    await buildCustomGridScene();

    await flushPanelLoad();
    expect(getInterceptors()).toHaveLength(0);
  });

  it('does not render when not editing', async () => {
    await buildAutoGridScene({ isEditing: false });
    expect(getInterceptors()).toHaveLength(0);
  });
});

const buildAutoGridScene = async ({ isEditing = true, repeat = true } = {}) => {
  const panel = new VizPanel({ title: 'Panel $values', key: 'panel-1', pluginId: 'table' });

  const gridItem = new AutoGridItem({
    key: 'grid-item-1',
    body: panel,
    variableName: repeat ? 'values' : undefined,
  });

  const scene = new DashboardScene({
    isEditing,
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

  const { unmount } = render(<scene.Component model={scene} />);
  await flushPanelLoad();
  return { scene, gridItem, unmount };
};

const buildCustomGridScene = async () => {
  const scene = new DashboardScene({
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

  const { unmount } = render(<scene.Component model={scene} />);
  await flushPanelLoad();

  return { scene, unmount };
};
