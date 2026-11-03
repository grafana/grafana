import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { getLibraryPanelsWithUnsavedChanges } from '../../saving/getLibraryPanelsWithUnsavedChanges';
import { DashboardScene } from '../../scene/DashboardScene';
import { LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { usePanelSidebarVizOptions } from './usePanelSidebarVizOptions';

// Stands in for the time series plugin, so the timeseries entry of PANEL_SIDEBAR_OPTIONS applies
const timeseries = getPanelPlugin({ id: 'timeseries' })
  .setPanelOptions((builder) =>
    builder
      .addBooleanSwitch({ path: 'legend.showLegend', name: 'Visibility', category: ['Legend'], defaultValue: true })
      .addBooleanSwitch({ path: 'legend.enableFacetedFilter', name: 'Series visibility', category: ['Legend'] })
  )
  .useFieldConfig({
    useCustomConfig: (builder) =>
      builder.addBooleanSwitch({ path: 'axisBorderShow', name: 'Axis border', category: ['Axis'] }),
  });
const gauge = getPanelPlugin({ id: 'gauge' }).setPanelOptions((builder) =>
  builder.addBooleanSwitch({ path: 'legend.showLegend', name: 'Visibility', category: ['Legend'] })
);
const plugins = [timeseries, gauge];

setPluginImportUtils({
  importPanelPlugin: async (id) => plugins.find((p) => p.meta.id === id)!,
  getPanelPluginFromCache: (id) => plugins.find((p) => p.meta.id === id),
});

function SidebarVizOptions({ panel }: { panel: VizPanel }) {
  return <>{usePanelSidebarVizOptions(panel).map((category) => category.renderElement())}</>;
}

let deactivate: () => void;
afterEach(() => deactivate?.());

function setup({ pluginId = 'timeseries', libraryPanel = false } = {}) {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId,
    options: { legend: { showLegend: true } },
    fieldConfig: { defaults: {}, overrides: [] },
    $behaviors: libraryPanel
      ? [new LibraryPanelBehavior({ uid: 'lib-1', name: 'Shared CPU', isLoaded: true })]
      : undefined,
  });
  const dashboard = new DashboardScene({
    isEditing: true,
    body: new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [new AutoGridItem({ body: panel })] }) }),
  });
  deactivate = activateFullSceneTree(dashboard);
  render(<SidebarVizOptions panel={panel} />);
  return { panel, dashboard, sidebar: dashboard.state.sidebar, user: userEvent.setup() };
}

describe('usePanelSidebarVizOptions', () => {
  it('shows only the options listed for the visualization, in panel editor categories', async () => {
    setup();

    expect(await screen.findByRole('switch', { name: 'Visibility' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Legend' })).toContainElement(
      screen.getByRole('switch', { name: 'Visibility' })
    );
    expect(screen.queryByRole('switch', { name: 'Series visibility' })).not.toBeInTheDocument();
    expect(screen.queryByText('Axis')).not.toBeInTheDocument();
  });

  it('adds nothing for visualizations without options configured', () => {
    setup({ pluginId: 'gauge' });

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('applies changes as undoable edit actions', async () => {
    const { panel, sidebar, user } = setup();

    await user.click(screen.getByRole('switch', { name: 'Visibility' }));

    expect(panel.state.options.legend?.showLegend).toBe(false);
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.undoStack[0].description).toBe('Legend: Visibility');

    act(() => sidebar.undoAction());
    expect(panel.state.options.legend?.showLegend).toBe(true);
    expect(screen.getByRole('switch', { name: 'Visibility' })).toBeChecked();

    act(() => sidebar.redoAction());
    expect(panel.state.options.legend?.showLegend).toBe(false);
  });

  describe('library panels', () => {
    it('tracks unsaved changes until undone', async () => {
      const { panel, dashboard, sidebar, user } = setup({ libraryPanel: true });
      const saveButton = () => screen.getByRole('button', { name: 'Save library panel' });

      expect(screen.getByText('Library panel: Shared CPU')).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();

      await user.click(screen.getByRole('switch', { name: 'Visibility' }));
      expect(saveButton()).toBeEnabled();
      expect(getLibraryPanelsWithUnsavedChanges(dashboard)).toEqual([panel]);

      act(() => sidebar.undoAction());
      expect(saveButton()).toBeDisabled();
      expect(getLibraryPanelsWithUnsavedChanges(dashboard)).toEqual([]);
    });

    it('discards unsaved changes as an undoable action', async () => {
      const { panel, dashboard, sidebar, user } = setup({ libraryPanel: true });

      await user.click(screen.getByRole('switch', { name: 'Visibility' }));
      await user.click(screen.getByRole('button', { name: 'Discard' }));

      expect(panel.state.options.legend?.showLegend).toBe(true);
      expect(getLibraryPanelsWithUnsavedChanges(dashboard)).toEqual([]);

      act(() => sidebar.undoAction());
      expect(panel.state.options.legend?.showLegend).toBe(false);
      expect(getLibraryPanelsWithUnsavedChanges(dashboard)).toEqual([panel]);
    });
  });
});
