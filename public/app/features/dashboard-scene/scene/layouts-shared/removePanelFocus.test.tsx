import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { EventBusSrv, type PanelProps } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setAppEvents, setPluginImportUtils, setPluginLinksHook } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardEditActionEvent } from '../../sidebar/events';
import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';

function TestPanel(props: PanelProps) {
  return <div>{props.title}</div>;
}

const layouts: Array<[string, (panels: VizPanel[]) => DashboardLayoutManager]> = [
  [
    'AutoGridLayoutManager',
    (panels) =>
      new AutoGridLayoutManager({
        layout: new AutoGridLayout({
          children: panels.map((panel, index) => new AutoGridItem({ key: `auto-grid-item-${index}`, body: panel })),
        }),
      }),
  ],
  ['DefaultGridLayoutManager', (panels) => DefaultGridLayoutManager.fromVizPanels(panels)],
];

beforeAll(() => {
  setPluginImportUtils({
    importPanelPlugin: () => Promise.resolve(getPanelPlugin({ id: 'table' }, TestPanel)),
    getPanelPluginFromCache: () => undefined,
  });
  // PanelChrome publishes a SetPanelAttentionEvent on focus; needs an app event bus to exist.
  setAppEvents(new EventBusSrv());
  // DashboardScene renders the sidebar extension point, which reads plugin links.
  setPluginLinksHook(() => ({ links: [], isLoading: false }));
});

describe.each(layouts)('%s removePanel focus', (_name, createLayout) => {
  async function setup() {
    // Numeric keys: DefaultGridLayoutManager derives grid item keys from panel ids.
    const panels = ['A', 'B', 'C'].map(
      (name, index) => new VizPanel({ title: `Panel ${name}`, key: `panel-${index + 1}`, pluginId: 'table' })
    );
    const layout = createLayout(panels);
    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: layout,
    });
    // The sidebar normally performs edit actions; these tests don't activate it.
    scene.subscribeToEvent(DashboardEditActionEvent, (event) => event.payload.perform());

    render(<scene.Component model={scene} />);
    for (const panel of panels) {
      await screen.findByTestId(selectors.components.Panels.Panel.title(panel.state.title));
    }

    return { layout, panels };
  }

  async function removeAndWaitForFocus(layout: DashboardLayoutManager, panel: VizPanel) {
    act(() => layout.removePanel!(panel));
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
  }

  const panelTitle = (title: string) => screen.getByTestId(selectors.components.Panels.Panel.title(title));

  it('moves focus to the next panel when the focused panel is removed', async () => {
    const { layout, panels } = await setup();
    act(() => panelTitle('Panel B').focus());

    await removeAndWaitForFocus(layout, panels[1]);

    expect(screen.queryByText('Panel B')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(panelTitle('Panel C'));
  });

  it('moves focus to the previous panel when the last panel is removed', async () => {
    const { layout, panels } = await setup();
    act(() => panelTitle('Panel C').focus());

    await removeAndWaitForFocus(layout, panels[2]);

    expect(document.activeElement).toBe(panelTitle('Panel B'));
  });

  it('does not take focus when a panel is removed programmatically', async () => {
    const { layout, panels } = await setup();
    act(() => panelTitle('Panel A').focus());

    await removeAndWaitForFocus(layout, panels[1]);

    expect(screen.queryByText('Panel B')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(panelTitle('Panel A'));
  });
});
