import { screen, waitFor } from '@testing-library/react';
import { render, userEvent } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { setPluginLinksHook } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { type DashboardPlanningState } from '../types/dashboard';

import { RowItem } from './RowItem';
import { RowsLayoutManager } from './RowsLayoutManager';

setPluginLinksHook(() => ({ links: [], isLoading: false }));

function renderRow({
  collapse = false,
  title = 'My row',
  isEditing = false,
  planning,
}: { collapse?: boolean; title?: string; isEditing?: boolean; planning?: DashboardPlanningState } = {}) {
  const row = new RowItem({
    key: 'row-1',
    title,
    collapse,
    layout: AutoGridLayoutManager.createEmpty(),
  });
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: new RowsLayoutManager({ rows: [row] }),
    isEditing,
    planning,
  });
  render(<scene.Component model={scene} />);
  return { row, scene };
}

describe('RowItemRenderer', () => {
  it('stamps data-dashboard-element-key and data-dashboard-element-type on the row header', () => {
    renderRow({ collapse: false });

    const header = document.querySelector('[data-dashboard-element-key="row-1"]');
    expect(header).toBeInTheDocument();
    expect(header).toHaveAttribute('data-dashboard-element-type', 'row');
  });

  it('stamps the row header when the row is collapsed', () => {
    renderRow({ collapse: true });

    const header = document.querySelector('[data-dashboard-element-key="row-1"]');
    expect(header).toBeInTheDocument();
    expect(header).toHaveAttribute('data-dashboard-element-type', 'row');
  });

  it('exposes aria-expanded=true on the toggle button when the row is expanded', () => {
    const { row } = renderRow({ collapse: false });

    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('exposes aria-expanded=false on the toggle button when the row is collapsed', () => {
    const { row } = renderRow({ collapse: true });

    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('updates aria-expanded when the row is toggled', async () => {
    const { row } = renderRow({ collapse: false });
    const toggle = screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('records collapsing the row in undo history while editing', async () => {
    const { row, scene } = renderRow({ collapse: false, isEditing: true });
    const deactivateSidebar = scene.state.sidebar.activate();
    await waitFor(() => {
      expect(document.querySelector('[data-rfd-drag-handle-draggable-id="row-1"]')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!)));

    expect(row.state.collapse).toBe(true);
    expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
    deactivateSidebar();
  });

  it('does not record collapsing the row in undo history outside edit mode', async () => {
    const { row, scene } = renderRow({ collapse: false });
    const deactivateSidebar = scene.state.sidebar.activate();

    await userEvent.click(screen.getByTestId(selectors.components.DashboardRow.toggle(row.state.title!)));

    expect(row.state.collapse).toBe(true);
    expect(scene.state.sidebar.state.undoStack).toHaveLength(0);
    deactivateSidebar();
  });

  it('copies a link to the row when the copy link button is clicked', async () => {
    // ClipboardButton only uses the clipboard API in a secure context.
    // userEvent.setup() (called by render) attaches a working clipboard stub we can read back.
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    renderRow({ title: 'My row' });

    await userEvent.click(screen.getByRole('button', { name: 'Copy link to row' }));

    expect(await navigator.clipboard.readText()).toContain('drow=My-row');
  });

  it('hides the copy link button while editing', async () => {
    renderRow({ isEditing: true });

    await waitFor(() => {
      expect(document.querySelector('[data-rfd-drag-handle-draggable-id="row-1"]')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Copy link to row' })).not.toBeInTheDocument();
  });

  it('hides the copy link button while previewing a dashboard plan (planning)', () => {
    renderRow({
      planning: {
        phase: 'preview',
        planId: 'plan-1',
        planTitle: 'Dashboard plan',
        onBuild: () => {},
        onDismiss: () => {},
      },
    });

    expect(screen.getByRole('button', { name: 'Collapse row My row' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy link to row' })).not.toBeInTheDocument();
  });

  it('copies a link with the full slug path for a nested row', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    const nestedRow = new RowItem({ title: 'Row 1', layout: AutoGridLayoutManager.createEmpty() });
    const outerRow = new RowItem({ title: 'Row 2', layout: new RowsLayoutManager({ rows: [nestedRow] }) });
    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: new RowsLayoutManager({ rows: [outerRow] }),
    });
    render(<scene.Component model={scene} />);

    const copyButtons = screen.getAllByRole('button', { name: 'Copy link to row' });
    expect(copyButtons).toHaveLength(2);

    // The outer row's header renders before the nested row's header
    await userEvent.click(copyButtons[1]);

    const copiedUrl = new URL(await navigator.clipboard.readText());
    expect(copiedUrl.searchParams.get('drow')).toBe('Row-2/Row-1');
  });

  it('encodes slashes in row titles so they do not look like nested paths', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    renderRow({ title: 'Foo/Bar' });

    await userEvent.click(screen.getByRole('button', { name: 'Copy link to row' }));

    const copiedUrl = new URL(await navigator.clipboard.readText());
    expect(copiedUrl.searchParams.get('drow')).toBe('Foo%2FBar');
  });

  describe('Alt+click behavior', () => {
    it('collapses all rows when Alt+clicking on an expanded row toggle', async () => {
      const row1 = new RowItem({ key: 'row-1', title: 'Row 1', collapse: false, layout: AutoGridLayoutManager.createEmpty() });
      const row2 = new RowItem({ key: 'row-2', title: 'Row 2', collapse: false, layout: AutoGridLayoutManager.createEmpty() });
      const layout = new RowsLayoutManager({ rows: [row1, row2] });
      const scene = new DashboardScene({
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        body: layout,
      });
      
      // Activate the sidebar to enable edit actions
      const deactivateSidebar = scene.state.sidebar.activate();
      
      render(<scene.Component model={scene} />);

      const toggle1 = screen.getByTestId(selectors.components.DashboardRow.toggle(row1.state.title!));

      // Alt+click the first row toggle using keyboard modifier
      await userEvent.keyboard('[AltLeft>]');
      await userEvent.click(toggle1);
      await userEvent.keyboard('[/AltLeft]');

      // Both rows should be collapsed
      expect(row1.getCollapsedState()).toBe(true);
      expect(row2.getCollapsedState()).toBe(true);
      
      deactivateSidebar();
    });

    it('expands all rows when Alt+clicking on a collapsed row toggle', async () => {
      const row1 = new RowItem({ key: 'row-1', title: 'Row 1', collapse: true, layout: AutoGridLayoutManager.createEmpty() });
      const row2 = new RowItem({ key: 'row-2', title: 'Row 2', collapse: true, layout: AutoGridLayoutManager.createEmpty() });
      const layout = new RowsLayoutManager({ rows: [row1, row2] });
      const scene = new DashboardScene({
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        body: layout,
      });
      
      // Activate the sidebar to enable edit actions
      const deactivateSidebar = scene.state.sidebar.activate();
      
      render(<scene.Component model={scene} />);

      const toggle1 = screen.getByTestId(selectors.components.DashboardRow.toggle(row1.state.title!));

      // Alt+click the first row toggle using keyboard modifier
      await userEvent.keyboard('[AltLeft>]');
      await userEvent.click(toggle1);
      await userEvent.keyboard('[/AltLeft]');

      // Both rows should be expanded
      expect(row1.getCollapsedState()).toBe(false);
      expect(row2.getCollapsedState()).toBe(false);
      
      deactivateSidebar();
    });

    it('only toggles one row when clicking without Alt key', async () => {
      const row1 = new RowItem({ key: 'row-1', title: 'Row 1', collapse: false, layout: AutoGridLayoutManager.createEmpty() });
      const row2 = new RowItem({ key: 'row-2', title: 'Row 2', collapse: false, layout: AutoGridLayoutManager.createEmpty() });
      const layout = new RowsLayoutManager({ rows: [row1, row2] });
      const scene = new DashboardScene({
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        body: layout,
      });
      render(<scene.Component model={scene} />);

      const toggle1 = screen.getByTestId(selectors.components.DashboardRow.toggle(row1.state.title!));

      // Normal click (without Alt)
      await userEvent.click(toggle1);

      // Only the first row should be collapsed
      expect(row1.getCollapsedState()).toBe(true);
      expect(row2.getCollapsedState()).toBe(false);
    });
  });
});
