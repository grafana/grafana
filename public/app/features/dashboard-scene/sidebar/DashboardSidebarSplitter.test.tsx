import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils, setPluginLinksHook, config } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DashboardSidebarSplitter } from './DashboardSidebarSplitter';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

setPluginLinksHook(() => ({ links: [], isLoading: false }));

const autoLayoutInputs = [
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth,
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns,
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight,
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen,
];

describe('DashboardSidebarSplitter', () => {
  beforeEach(() => {
    config.featureToggles.dashboardNewLayouts = true;
  });

  it('should switch between custom and auto layout', async () => {
    const user = userEvent.setup();
    const scene = buildTestScene();

    render(<DashboardSidebarSplitter dashboard={scene} />);

    await user.click(screen.getByTestId(selectors.pages.Dashboard.Sidebar.optionsButton));

    // switch to auto and confirm change
    await user.click(await screen.findByLabelText('layout-selection-option-Auto'));
    let confirmButton = screen.getByTestId(selectors.pages.ConfirmModal.delete);
    await user.click(confirmButton);

    // check auto layout inputs are visible
    autoLayoutInputs.forEach((testId) => {
      expect(screen.queryByTestId(testId)).toBeInTheDocument();
    });
    expect(scene.state.body).toBeInstanceOf(AutoGridLayoutManager);

    // switch back to custom and confirm change
    await user.click(screen.getByLabelText('layout-selection-option-Custom'));
    confirmButton = screen.getByTestId(selectors.pages.ConfirmModal.delete);
    await user.click(confirmButton);

    // check that auto layout inputs are not visible in custom
    autoLayoutInputs.forEach((testId) => {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    });
  });

  it('parks beside the time picker without shifting the canvas and keeps an empty pill after clearing selection', async () => {
    const user = userEvent.setup();
    const scene = buildTestScene();
    render(
      <DashboardSidebarSplitter
        dashboard={scene}
        isEditing
        controls={
          <>
            <button data-testid={selectors.components.TimePicker.moveBackwardButton}>Previous time range</button>
            <button data-testid={selectors.components.TimePicker.openButton}>Time range</button>
          </>
        }
      />
    );
    const timePicker = screen.getByTestId(selectors.components.TimePicker.moveBackwardButton);
    jest.spyOn(timePicker, 'getBoundingClientRect').mockReturnValue({
      x: 800,
      y: 80,
      left: 800,
      top: 80,
      right: 832,
      bottom: 112,
      width: 32,
      height: 32,
      toJSON: () => ({}),
    });

    await user.click(screen.getByTestId(selectors.pages.Dashboard.Sidebar.optionsButton));
    await user.click(screen.getByLabelText('Float toolbox'));
    await user.click(screen.getByLabelText('Move away from panels'));
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveStyle(
      'left: 352px; top: 72px; height: 48px'
    );
    expect(screen.getByTestId(selectors.components.DashboardSidebarSplitter.primaryBody)).toHaveStyle(
      'padding-top: 0px'
    );

    await user.click(screen.getByTestId(selectors.components.DashboardSidebarSplitter.bodyContainer));
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveTextContent('Nothing is selected');
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveStyle(
      'width: 320px; height: 48px; left: 472px; top: 72px'
    );
    expect(scene.state.sidebar.getSelectedObject()).toBeUndefined();
    expect(scene.state.sidebar.state.undoStack).toEqual([]);
    expect(screen.getByTestId(selectors.components.DashboardSidebarSplitter.primaryBody)).toHaveStyle(
      'padding-top: 0px'
    );
  });

  it('makes the scroll container keyboard-focusable so arrow/page keys can scroll the dashboard', () => {
    const scene = buildTestScene();

    render(<DashboardSidebarSplitter dashboard={scene} />);

    const scrollContainer = screen.getByTestId(selectors.components.DashboardSidebarSplitter.bodyContainer);
    expect(scrollContainer).toHaveAttribute('tabindex', '0');
  });
});

export function buildTestScene() {
  const testScene = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $data: new DashboardDataLayerSet({ annotationLayers: [] }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [new DashboardGridItem({ body: new VizPanel({ key: 'panel-1', pluginId: 'text' }) })],
      }),
    }),
  });
  return testScene;
}
