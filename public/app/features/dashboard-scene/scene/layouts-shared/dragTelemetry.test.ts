import { getPanelPlugin } from '@grafana/data/test';
import { reportInteraction, setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { reorderRows } from '../../actions/layout/reorderRows';
import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { DRAG_UNDO_WINDOW_MS, DragTelemetry, flushDragTelemetry, getDragLayoutType } from './dragTelemetry';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const reportInteractionMock = jest.mocked(reportInteraction);

describe('DragTelemetry', () => {
  let deactivate: (() => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true });
  });

  afterEach(() => {
    flushDragTelemetry();
    reportInteractionMock.mockClear();
    jest.useRealTimers();
    setTestFlags({});
    deactivate?.();
    deactivate = undefined;
  });

  function setup() {
    const rows = new RowsLayoutManager({
      rows: [new RowItem({ title: 'Row A' }), new RowItem({ title: 'Row B' }), new RowItem({ title: 'Row C' })],
    });
    const dashboard = new DashboardScene({ isEditing: true, body: rows });
    deactivate = activateFullSceneTree(dashboard);
    return { rows, sidebar: dashboard.state.sidebar };
  }

  function reports() {
    return reportInteractionMock.mock.calls
      .filter(([name]) => name === 'dashboards_drag_ended')
      .map(([, props]) => props);
  }

  it('reports a drop that was not undone once the undo window is over, with numbers and layout types only', () => {
    const { rows, sidebar } = setup();
    const telemetry = DragTelemetry.start('row', rows, sidebar, { x: 10, y: 10 })!;
    telemetry.move(10, 40);
    telemetry.move(10, 120);
    telemetry.move(10, 260);
    jest.advanceTimersByTime(800);

    reorderRows(rows, 0, 2);
    telemetry.end(rows);

    expect(reports()).toHaveLength(0);
    jest.advanceTimersByTime(DRAG_UNDO_WINDOW_MS);
    expect(reports()).toEqual([
      {
        kind: 'row',
        sourceLayout: 'rows',
        targetLayout: 'rows',
        outcome: 'drop',
        durationMs: 800,
        moves: 3,
        undone: false,
        isDynamicDashboard: expect.any(Boolean),
      },
    ]);
  });

  it('reports the drop as undone right away when the user undoes it within the undo window', () => {
    const { rows, sidebar } = setup();
    const telemetry = DragTelemetry.start('row', rows, sidebar, { x: 10, y: 10 })!;
    telemetry.move(10, 260);
    reorderRows(rows, 0, 2);
    telemetry.end(rows);

    jest.advanceTimersByTime(3000);
    sidebar.undoAction();

    expect(reports()).toEqual([expect.objectContaining({ outcome: 'drop', undone: true })]);
    jest.advanceTimersByTime(DRAG_UNDO_WINDOW_MS);
    expect(reports()).toHaveLength(1);
  });

  it('counts a drop committed shortly after the drag ended, as drops from the Add pane are', () => {
    const { rows, sidebar } = setup();
    const telemetry = DragTelemetry.start('new_panel', null, sidebar)!;
    telemetry.move(300, 300);
    telemetry.end(rows);

    jest.advanceTimersByTime(100);
    reorderRows(rows, 0, 1);
    jest.advanceTimersByTime(DRAG_UNDO_WINDOW_MS);

    expect(reports()).toEqual([
      expect.objectContaining({ kind: 'new_panel', sourceLayout: 'none', targetLayout: 'rows', outcome: 'drop' }),
    ]);
  });

  it('reports a release that changed nothing as a no-op, even when the user edits something else afterwards', () => {
    const { rows, sidebar } = setup();
    const telemetry = DragTelemetry.start('row', rows, sidebar, { x: 10, y: 10 })!;
    telemetry.move(10, 150);
    telemetry.end(rows);

    jest.advanceTimersByTime(2000);
    reorderRows(rows, 0, 1);
    jest.advanceTimersByTime(DRAG_UNDO_WINDOW_MS);

    expect(reports()).toEqual([expect.objectContaining({ outcome: 'no_op', undone: false })]);
  });

  it('reports a cancelled drag right away, without a target', () => {
    const { rows, sidebar } = setup();
    const telemetry = DragTelemetry.start('tab', TabsLayoutManager.createEmpty(), sidebar, { x: 10, y: 10 })!;
    telemetry.move(60, 10);

    telemetry.end(rows, { isCancelled: true });

    expect(reports()).toEqual([
      expect.objectContaining({ kind: 'tab', sourceLayout: 'tabs', targetLayout: 'none', outcome: 'cancel', moves: 1 }),
    ]);
  });

  it('does not report a press that never moved far enough to be a drag, e.g. a click on a panel header', () => {
    const { rows, sidebar } = setup();
    const telemetry = DragTelemetry.start('panel', rows, sidebar, { x: 10, y: 10 })!;
    telemetry.move(11, 12);

    telemetry.end(rows);
    jest.advanceTimersByTime(DRAG_UNDO_WINDOW_MS);

    expect(reports()).toHaveLength(0);
  });

  it('reports the previous drag when the next one starts, before its undo window is over', () => {
    const { rows, sidebar } = setup();
    const first = DragTelemetry.start('row', rows, sidebar, { x: 10, y: 10 })!;
    first.move(10, 150);
    first.end(rows);

    DragTelemetry.start('row', rows, sidebar, { x: 10, y: 10 });

    expect(reports()).toHaveLength(1);
  });

  it('does not count anything with the unified drag and drop flag off', () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: false });
    const { rows, sidebar } = setup();

    expect(DragTelemetry.start('row', rows, sidebar, { x: 10, y: 10 })).toBeNull();
    reorderRows(rows, 0, 2);
    flushDragTelemetry();
    jest.advanceTimersByTime(DRAG_UNDO_WINDOW_MS);

    expect(reports()).toHaveLength(0);
  });
});

describe('getDragLayoutType', () => {
  it('names the layout kinds a drag goes from and to', () => {
    expect(getDragLayoutType(DefaultGridLayoutManager.createEmpty())).toBe('custom_grid');
    expect(getDragLayoutType(AutoGridLayoutManager.createEmpty())).toBe('auto_grid');
    expect(getDragLayoutType(new RowsLayoutManager({ rows: [] }))).toBe('rows');
    expect(getDragLayoutType(TabsLayoutManager.createEmpty())).toBe('tabs');
    expect(getDragLayoutType(new RowItem({}))).toBe('row');
    expect(getDragLayoutType(new TabItem({}))).toBe('tab');
    expect(getDragLayoutType(null)).toBe('none');
  });
});
