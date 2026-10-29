import { act, renderHook } from '@testing-library/react';
import { type PointerEvent as ReactPointerEvent } from 'react';

import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { activateFullSceneTree } from '../../../utils/test-utils';
import { DashboardScene } from '../../DashboardScene';
import { AutoGridLayoutManager } from '../../layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../layout-rows/RowItem';
import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { TabItem } from '../../layout-tabs/TabItem';
import { TabsLayoutManager } from '../../layout-tabs/TabsLayoutManager';

import { LIST_DROP_KEY_ATTR, LIST_ITEM_KEY_ATTR, TAB_ACTIVATION_KEY_ATTR } from './attributes';
import { useRowDrag, useRowsListDrag } from './useListDrag';

const TAB_ACTIVATION_DELAY_MS = 600;

describe('row drag hooks', () => {
  const originalElementsFromPoint = document.elementsFromPoint;
  let elementsUnderPointer: Element[] = [];
  let deactivate: (() => void) | undefined;

  beforeEach(() => {
    document.elementsFromPoint = () => elementsUnderPointer;
  });

  afterEach(() => {
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 10 }));
    document.elementsFromPoint = originalElementsFromPoint;
    elementsUnderPointer = [];
    document.body.innerHTML = '';
    deactivate?.();
    deactivate = undefined;
    setTestFlags({});
  });

  describe('with the unified drag and drop flag off', () => {
    it('hands the rows list its rows unchanged and no attributes, so hello-pangea/dnd drags them', () => {
      const { source } = setup();

      const { result } = renderHook(() => useRowsListDrag(source, source.state.rows, true));

      expect(result.current.isEnabled).toBe(false);
      expect(result.current.rows).toBe(source.state.rows);
      expect(result.current.dropPlaceholder).toBeNull();
      expect(result.current.attributes).toEqual({});
    });

    it('gives a row nothing', () => {
      const { rowA } = setup();

      const { result } = renderHook(() => useRowDrag(rowA, true));

      expect(result.current).toBeUndefined();
    });
  });

  describe('with the unified drag and drop flag on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    it('marks the rows list and its rows for hit-testing while editing', () => {
      const { source, rowA } = setup();
      const clone = new RowItem({ key: 'clone', repeatSourceKey: rowA.state.key });
      rowA.setState({ repeatedRows: [clone] });

      const list = renderHook(() => useRowsListDrag(source, source.state.rows, true));
      const row = renderHook(() => useRowDrag(rowA, true));
      const repeatedRow = renderHook(() => useRowDrag(clone, false));

      expect(list.result.current.isEnabled).toBe(true);
      expect(list.result.current.attributes).toEqual({ [LIST_DROP_KEY_ATTR]: source.state.key });
      expect(row.result.current?.attributes).toEqual({ [LIST_ITEM_KEY_ATTR]: rowA.state.key });
      expect(row.result.current?.onPointerDown).toBeInstanceOf(Function);
      // A repeated copy counts as part of the row it repeats, and can't be dragged itself
      expect(repeatedRow.result.current?.attributes).toEqual({ [LIST_ITEM_KEY_ATTR]: rowA.state.key });
      expect(repeatedRow.result.current?.onPointerDown).toBeUndefined();

      const viewList = renderHook(() => useRowsListDrag(source, source.state.rows, false));
      expect(viewList.result.current.isEnabled).toBe(true);
      expect(viewList.result.current.attributes).toEqual({});
    });

    it('renders the dragged row where it would be dropped, and a placeholder in the list it is dragged over', () => {
      const { source, target, rowA } = setup();
      const sourceEl = renderList(source);
      const targetEl = renderList(target);
      const sourceList = renderHook(() => useRowsListDrag(source, source.state.rows, true));
      const targetList = renderHook(() => useRowsListDrag(target, target.state.rows, true));
      const draggedRow = renderHook(() => useRowDrag(rowA, true));

      draggedRow.result.current?.onPointerDown?.(press(10, 10));
      elementsUnderPointer = [sourceEl];
      act(() => moveTo(10, 260));

      expect(titles(sourceList.result.current.rows)).toEqual(['Row B', 'Row C', 'Row A']);
      expect(sourceList.result.current.dropPlaceholder).toBeNull();
      expect(titles(targetList.result.current.rows)).toEqual(['Row T']);
      expect(draggedRow.result.current?.className).toBeDefined();

      elementsUnderPointer = [targetEl];
      act(() => moveTo(10, 80));

      expect(titles(sourceList.result.current.rows)).toEqual(['Row A', 'Row B', 'Row C']);
      expect(targetList.result.current.dropPlaceholder).toEqual({ index: 1, height: 40 });

      act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      expect(targetList.result.current.dropPlaceholder).toBeNull();
      expect(draggedRow.result.current?.className).toBeUndefined();
    });
  });

  describe('the layout orchestrator', () => {
    beforeEach(() => {
      setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true });
      jest.useFakeTimers();
    });
    afterEach(() => jest.useRealTimers());

    it('opens a hovered tab during a row drag, and Escape after that still cancels the drag', () => {
      const { dashboard, source, target, targetTab, tabs, rowA } = setup();
      const orchestrator = dashboard.state.layoutOrchestrator!;
      renderList(source);
      const header = document.createElement('div');
      header.setAttribute(TAB_ACTIVATION_KEY_ATTR, targetTab.state.key!);

      orchestrator.startListDrag(press(10, 10), rowA);
      expect(orchestrator.isDragging()).toBe(false);
      elementsUnderPointer = [header];
      moveTo(10, 30);
      expect(orchestrator.isDragging()).toBe(true);
      expect(orchestrator.state.dragPreview).toMatchObject({ label: 'Row A', type: 'row', height: 40 });

      jest.advanceTimersByTime(TAB_ACTIVATION_DELAY_MS);
      expect(tabs.getCurrentTab()).toBe(targetTab);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 30 }));

      expect(orchestrator.isDragging()).toBe(false);
      expect(orchestrator.getListDragState()).toBeNull();
      expect(orchestrator.state.dragPreview).toBeUndefined();
      expect(titles(source.state.rows)).toEqual(['Row A', 'Row B', 'Row C']);
      expect(titles(target.state.rows)).toEqual(['Row T']);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
    });
  });

  function setup() {
    const rowA = new RowItem({ title: 'Row A' });
    const rowB = new RowItem({ title: 'Row B' });
    const rowC = new RowItem({ title: 'Row C' });
    const source = new RowsLayoutManager({ rows: [rowA, rowB, rowC] });
    const rowT = new RowItem({ title: 'Row T' });
    const target = new RowsLayoutManager({ rows: [rowT] });
    const sourceTab = new TabItem({ title: 'Source', layout: source });
    const targetTab = new TabItem({ title: 'Rows target', layout: target });
    const tabs = new TabsLayoutManager({
      tabs: [sourceTab, targetTab, new TabItem({ title: 'Grid', layout: AutoGridLayoutManager.createEmpty() })],
      currentTabSlug: sourceTab.getSlug(),
    });
    const dashboard = new DashboardScene({ isEditing: true, body: tabs });
    deactivate = activateFullSceneTree(dashboard);
    return { dashboard, tabs, source, target, sourceTab, targetTab, rowA, rowB, rowC, rowT };
  }
});

function titles(rows: RowItem[]) {
  return rows.map((row) => row.state.title);
}

function press(clientX: number, clientY: number) {
  return { button: 0, clientX, clientY, target: null } as unknown as ReactPointerEvent;
}

function moveTo(clientX: number, clientY: number) {
  window.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY, buttons: 1 }));
}

function renderList(list: RowsLayoutManager): HTMLElement {
  const listEl = document.createElement('div');
  listEl.setAttribute(LIST_DROP_KEY_ATTR, list.state.key!);
  list.state.rows.forEach((row, index) => {
    const rowEl = document.createElement('div');
    rowEl.setAttribute(LIST_ITEM_KEY_ATTR, row.state.key!);
    const top = index * 100;
    const box = { x: 0, y: top, left: 0, top, width: 1000, height: 100, right: 1000, bottom: top + 100 };
    rowEl.getBoundingClientRect = () => ({ ...box, toJSON: () => box });
    listEl.appendChild(rowEl);
  });
  document.body.appendChild(listEl);
  return listEl;
}
