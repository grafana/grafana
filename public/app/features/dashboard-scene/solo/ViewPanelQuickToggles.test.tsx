import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { changeViewPanelOptions, changeViewPanelFieldConfig } from '../actions/panel/changeViewPanelOptions';
import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { ViewPanelQuickToggles } from './ViewPanelQuickToggles';

const plugin = getPanelPlugin({ id: 'quick-toggles' })
  .setPanelOptions((builder) =>
    builder.addBooleanSwitch({ path: 'legend.showLegend', name: 'Show legend', defaultValue: true })
  )
  .useFieldConfig({
    useCustomConfig: (builder) =>
      builder.addBooleanSwitch({ path: 'axisBorderShow', name: 'Axis border', defaultValue: false }),
  })
  .setViewPanelOptions({
    quickToggles: { optionProperties: ['legend.showLegend'], fieldConfigProperties: ['custom.axisBorderShow'] },
  });

setPluginImportUtils({ importPanelPlugin: async () => plugin, getPanelPluginFromCache: () => plugin });

let deactivate: () => void;
afterEach(() => deactivate?.());

function setup(isEditing = true) {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'quick-toggles',
    options: { legend: { showLegend: true } },
    fieldConfig: { defaults: { custom: { axisBorderShow: false } }, overrides: [] },
  });
  const dashboard = new DashboardScene({
    isEditing,
    viewPanel: 'panel-1',
    body: new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [new AutoGridItem({ body: panel })] }) }),
  });
  deactivate = activateFullSceneTree(dashboard);
  render(<ViewPanelQuickToggles panel={panel} plugin={plugin} />);
  return { panel, dashboard, sidebar: dashboard.state.sidebar, user: userEvent.setup() };
}

it.each(['Show legend', 'Axis border'])('undoes and redoes the %s quick toggle', async (label) => {
  const { panel, sidebar, user, dashboard } = setup();
  const before = { options: panel.state.options, fieldConfig: panel.state.fieldConfig };
  const initiallyChecked = label === 'Show legend';
  await user.click(screen.getByRole('switch', { name: `quick-toggles ${label}` }));
  expect(screen.getByRole('switch', { name: `quick-toggles ${label}` })).toHaveProperty('checked', !initiallyChecked);
  expect(sidebar.state.undoStack).toHaveLength(1);
  const after = { options: panel.state.options, fieldConfig: panel.state.fieldConfig };
  act(() => {
    dashboard.setState({ viewPanel: undefined });
    sidebar.undoAction();
  });
  expect(panel.state.options).toEqual(before.options);
  expect(panel.state.fieldConfig).toEqual(before.fieldConfig);
  expect(screen.getByRole('switch', { name: `quick-toggles ${label}` })).toHaveProperty('checked', initiallyChecked);
  act(() => sidebar.redoAction());
  expect(panel.state.options).toEqual(after.options);
  expect(panel.state.fieldConfig).toEqual(after.fieldConfig);
  expect(screen.getByRole('switch', { name: `quick-toggles ${label}` })).toHaveProperty('checked', !initiallyChecked);
});

it('clears redo history when another quick toggle is changed', async () => {
  const { sidebar, user } = setup();
  await user.click(screen.getByRole('switch', { name: 'quick-toggles Show legend' }));
  act(() => sidebar.undoAction());
  expect(sidebar.state.redoStack).toHaveLength(1);
  await user.click(screen.getByRole('switch', { name: 'quick-toggles Axis border' }));
  expect(screen.getByRole('switch', { name: 'quick-toggles Axis border' })).toBeChecked();
  expect(sidebar.state.redoStack).toHaveLength(0);
  expect(sidebar.state.undoStack).toHaveLength(1);
});

it('applies quick toggles outside edit mode without recording history', async () => {
  const { sidebar, user, panel } = setup(false);
  await user.click(screen.getByRole('switch', { name: 'quick-toggles Show legend' }));
  await user.click(screen.getByRole('switch', { name: 'quick-toggles Axis border' }));
  expect(panel.state.options.legend?.showLegend).toBe(false);
  expect(panel.state.fieldConfig.defaults.custom?.axisBorderShow).toBe(true);
  expect(sidebar.state.undoStack).toHaveLength(0);
});

it('preserves redo history for unchanged quick-toggle values', async () => {
  const { panel, sidebar, user } = setup();
  await user.click(screen.getByRole('switch', { name: 'quick-toggles Show legend' }));
  act(() => sidebar.undoAction());
  act(() => {
    changeViewPanelOptions(panel, { ...panel.state.options });
    changeViewPanelFieldConfig(panel, { ...panel.state.fieldConfig });
  });
  expect(panel.state.options.legend?.showLegend).toBe(true);
  expect(panel.state.fieldConfig.defaults.custom?.axisBorderShow).toBe(false);
  expect(sidebar.state.undoStack).toHaveLength(0);
  expect(sidebar.state.redoStack).toHaveLength(1);
});
