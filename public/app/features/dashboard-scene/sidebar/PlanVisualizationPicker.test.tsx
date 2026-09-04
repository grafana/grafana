import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { PlanVisualizationPicker } from './PlanVisualizationPicker';

jest.mock('../panel-edit/PanelVizTypePicker', () => ({
  // The real picker pulls in the whole plugin catalog; this stands in for it and lets the test
  // drive the one interaction that matters — choosing a type.
  PanelVizTypePicker: ({ onChange }: { onChange: (o: { pluginId: string }) => void }) => (
    <button onClick={() => onChange({ pluginId: 'piechart' })}>pick piechart</button>
  ),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id: string) => getPanelPlugin({ id }),
});

function setup(planning?: Partial<{ onPanelVisualizationChanged: jest.Mock }>) {
  const panel = new VizPanel({ title: 'Brokers up', key: 'panel-1', pluginId: 'timeseries' });
  const onPanelVisualizationChanged = planning?.onPanelVisualizationChanged ?? jest.fn();
  const scene = new DashboardScene({
    title: 'plan',
    meta: {},
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
    planning: {
      planTitle: 'Kafka overview',
      panelCount: 1,
      onBuild: jest.fn(),
      onDismiss: jest.fn(),
      onPanelVisualizationChanged,
    },
  });
  // Parent the panel so getDashboardSceneFor can resolve the scene from it.
  scene.state.body.addPanel(panel);

  render(<PlanVisualizationPicker panel={panel} />);
  return { panel, onPanelVisualizationChanged };
}

describe('PlanVisualizationPicker', () => {
  it('offers a way to change visualization without entering panel edit', () => {
    setup();

    expect(screen.getByTestId(selectors.components.Sidebar.changePlanVisualizationButton)).toBeInTheDocument();
  });

  it('applies the chosen visualization to the panel', async () => {
    const { panel } = setup();

    await userEvent.click(screen.getByTestId(selectors.components.Sidebar.changePlanVisualizationButton));
    await userEvent.click(screen.getByText('pick piechart'));

    expect(panel.state.pluginId).toBe('piechart');
  });

  it('tells the plan its sample data now has the wrong shape', async () => {
    const onPanelVisualizationChanged = jest.fn();
    setup({ onPanelVisualizationChanged });

    await userEvent.click(screen.getByTestId(selectors.components.Sidebar.changePlanVisualizationButton));
    await userEvent.click(screen.getByText('pick piechart'));

    expect(onPanelVisualizationChanged).toHaveBeenCalledWith('panel-1', 'piechart');
  });

  it('closes the picker once a type is chosen', async () => {
    setup();

    await userEvent.click(screen.getByTestId(selectors.components.Sidebar.changePlanVisualizationButton));
    expect(screen.queryByTestId(selectors.components.Sidebar.changePlanVisualizationButton)).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('pick piechart'));

    expect(screen.getByTestId(selectors.components.Sidebar.changePlanVisualizationButton)).toBeInTheDocument();
  });
});
