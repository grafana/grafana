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
import { useRowDrag, useRowsListDrag, useTabDrag, useTabsListDrag } from './useListDrag';

const TAB_ACTIVATION_DELAY_MS = 600;

describe('row and tab drag hooks', () => {
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

    it('hands the tab bar its tabs unchanged and no attributes, and gives a tab nothing', () => {
      const { tabs, sourceTab } = setup();

      const list = renderHook(() => useTabsListDrag(tabs, tabs.state.tabs, true));
      const tab = renderHook(() => useTabDrag(sourceTab, true));

      expect(list.result.current.isEnabled).toBe(false);
      expect(list.result.current.tabs).toBe(tabs.state.tabs);
      expect(list.result.current.dropPlaceholder).toBeNull();
      expect(list.result.current.attributes).toEqual({});
      expect(tab.result.current).toBeUndefined();
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
      expect(targetList.result.current.dropPlaceholder).toMatchObject({ index: 1, height: 40 });

      act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      expect(targetList.result.current.dropPlaceholder).toBeNull();
      expect(draggedRow.result.current?.className).toBeUndefined();
    });
  });

  describe('tabs, with the unified drag and drop flag on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    it('marks the tab bar and its tabs for hit-testing while editing, a repeated copy as part of its tab', () => {
      const { tabs, sourceTab } = setup();
      const clone = new TabItem({ key: 'tab-clone', repeatSourceKey: sourceTab.state.key });
      sourceTab.setState({ repeatedTabs: [clone] });

      const list = renderHook(() => useTabsListDrag(tabs, tabs.state.tabs, true));
      const tab = renderHook(() => useTabDrag(sourceTab, true));
      const repeatedTab = renderHook(() => useTabDrag(clone, false));

      expect(list.result.current.isEnabled).toBe(true);
      expect(list.result.current.attributes).toEqual({ [LIST_DROP_KEY_ATTR]: tabs.state.key });
      expect(tab.result.current?.attributes).toEqual({ [LIST_ITEM_KEY_ATTR]: sourceTab.state.key });
      expect(tab.result.current?.onPointerDownCapture).toBeInstanceOf(Function);
      expect(repeatedTab.result.current?.attributes).toEqual({ [LIST_ITEM_KEY_ATTR]: sourceTab.state.key });
      expect(repeatedTab.result.current?.onPointerDownCapture).toBeUndefined();

      const viewList = renderHook(() => useTabsListDrag(tabs, tabs.state.tabs, false));
      expect(viewList.result.current.attributes).toEqual({});
    });

    it('renders the dragged tab where it would be dropped, and a tab-sized placeholder in another tab bar', () => {
      const { dashboard, tabs, target, sourceTab } = setup();
      const otherBar = new TabsLayoutManager({ tabs: [new TabItem({ title: 'Other' })] });
      target.setState({ rows: [...target.state.rows, new RowItem({ title: 'Holder', layout: otherBar })] });
      sourceTab.containerRef.current = sizedElement(120, 32);
      const barEl = renderTabBar(tabs);
      const otherBarEl = renderTabBar(otherBar);
      const sourceList = renderHook(() => useTabsListDrag(tabs, tabs.state.tabs, true));
      const otherList = renderHook(() => useTabsListDrag(otherBar, otherBar.state.tabs, true));
      const draggedTab = renderHook(() => useTabDrag(sourceTab, true));

      draggedTab.result.current?.onPointerDownCapture?.(press(10, 10));
      elementsUnderPointer = [barEl];
      act(() => moveTo(160, 10));

      expect(tabTitles(sourceList.result.current.tabs)).toEqual(['Rows target', 'Source', 'Grid']);
      expect(draggedTab.result.current?.className).toBeDefined();
      expect(tabs.getCurrentTab()).toBe(sourceTab);

      elementsUnderPointer = [otherBarEl];
      act(() => moveTo(10, 10));
      expect(tabTitles(sourceList.result.current.tabs)).toEqual(['Source', 'Rows target', 'Grid']);
      expect(otherList.result.current.dropPlaceholder).toEqual({ index: 0, width: 120, height: 32 });

      act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      expect(otherList.result.current.dropPlaceholder).toBeNull();
      expect(draggedTab.result.current?.className).toBeUndefined();
      expect(tabTitles(tabs.state.tabs)).toEqual(['Source', 'Rows target', 'Grid']);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
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

    it('does not open tabs hovered during a tab drag, which reorders them instead', () => {
      const { dashboard, tabs, sourceTab, targetTab } = setup();
      const orchestrator = dashboard.state.layoutOrchestrator!;
      const header = document.createElement('a');
      header.setAttribute(TAB_ACTIVATION_KEY_ATTR, targetTab.state.key!);

      orchestrator.startListDrag(press(10, 10), sourceTab);
      elementsUnderPointer = [header, renderTabBar(tabs)];
      moveTo(160, 10);
      expect(orchestrator.state.dragPreview).toMatchObject({ label: 'Source', type: 'tab' });

      jest.advanceTimersByTime(TAB_ACTIVATION_DELAY_MS);
      expect(tabs.getCurrentTab()).toBe(sourceTab);

      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 160, clientY: 10 }));
      expect(tabTitles(tabs.state.tabs)).toEqual(['Rows target', 'Source', 'Grid']);
      expect(orchestrator.state.dragPreview).toBeUndefined();
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);
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

function tabTitles(tabs: TabItem[]) {
  return tabs.map((tab) => tab.state.title);
}

function sizedElement(width: number, height: number): HTMLDivElement {
  const el = document.createElement('div');
  const box = { x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height };
  el.getBoundingClientRect = () => ({ ...box, toJSON: () => box });
  return el;
}

/** A tab bar element with one 100px wide element per tab, side by side from the left of the page */
function renderTabBar(bar: TabsLayoutManager): HTMLElement {
  const barEl = document.createElement('div');
  barEl.setAttribute(LIST_DROP_KEY_ATTR, bar.state.key!);
  bar.state.tabs.forEach((tab, index) => {
    const tabEl = document.createElement('div');
    tabEl.setAttribute(LIST_ITEM_KEY_ATTR, tab.state.key!);
    const left = index * 100;
    const box = { x: left, y: 0, left, top: 0, width: 100, height: 32, right: left + 100, bottom: 32 };
    tabEl.getBoundingClientRect = () => ({ ...box, toJSON: () => box });
    barEl.appendChild(tabEl);
  });
  document.body.appendChild(barEl);
  return barEl;
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
