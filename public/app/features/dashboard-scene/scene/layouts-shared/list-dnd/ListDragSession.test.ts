import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { activateFullSceneTree } from '../../../utils/test-utils';
import { DashboardScene } from '../../DashboardScene';
import { AutoGridItem } from '../../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../layout-rows/RowItem';
import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { TabItem } from '../../layout-tabs/TabItem';
import { TabsLayoutManager } from '../../layout-tabs/TabsLayoutManager';
import { DASHBOARD_DROP_TARGET_KEY_ATTR } from '../../types/DashboardDropTarget';

import { type ListDragHost, ListDragSession } from './ListDragSession';
import { LIST_DROP_KEY_ATTR, LIST_ITEM_KEY_ATTR, TAB_ACTIVATION_KEY_ATTR } from './attributes';
import { createListDropTargetFinder, type ListItem } from './listDnd';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const ROW_HEIGHT = 100;

describe('ListDragSession', () => {
  const originalElementsFromPoint = document.elementsFromPoint;
  let elementsUnderPointer: Element[] = [];
  let deactivate: (() => void) | undefined;

  beforeEach(() => {
    document.elementsFromPoint = () => elementsUnderPointer;
  });

  afterEach(() => {
    document.elementsFromPoint = originalElementsFromPoint;
    elementsUnderPointer = [];
    document.body.innerHTML = '';
    deactivate?.();
    deactivate = undefined;
  });

  describe('within one rows layout', () => {
    it('reorders the rows live and commits the reorder as one undoable action', () => {
      const { source, rowA, sidebar } = setup();
      const sourceEl = renderList(source);
      const { session, host } = startDrag(rowA);

      elementsUnderPointer = [sourceEl];
      moveTo(10, 30);
      expect(session.getState()).toMatchObject({
        itemKey: rowA.state.key,
        sourceListKey: source.state.key,
        placeholderHeight: 40,
      });
      expect(describeTarget(session)).toEqual({ kind: 'list', key: source.state.key, index: 0 });
      expect(host.showPreview).toHaveBeenCalledWith(expect.objectContaining({ label: 'Row A', x: 10, y: 10 }));

      // Past the middle of the last other row (B spans 100-200, C 200-300)
      moveTo(10, 260);
      expect(describeTarget(session)).toEqual({ kind: 'list', key: source.state.key, index: 2 });

      release(10, 260);
      expect(titles(source)).toEqual(['Row B', 'Row C', 'Row A']);
      expect(session.getState()).toBeNull();
      expect(host.onEnd).toHaveBeenCalledTimes(1);
      expect(sidebar.state.undoStack).toHaveLength(1);

      sidebar.undoAction();
      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
      sidebar.redoAction();
      expect(titles(source)).toEqual(['Row B', 'Row C', 'Row A']);
    });

    it('does not add an undo step when the row is dropped where it was', () => {
      const { source, rowB, sidebar } = setup();
      elementsUnderPointer = [renderList(source)];
      startDrag(rowB);

      moveTo(10, 150);
      release(10, 150);

      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
      expect(sidebar.state.undoStack).toHaveLength(0);
    });
  });

  describe('into another rows layout', () => {
    it('moves the row into a rows layout in another tab at the hovered position', () => {
      const { source, target, rowA, sidebar } = setup();
      renderList(source);
      const targetEl = renderList(target);
      const { session } = startDrag(rowA);

      elementsUnderPointer = [targetEl];
      moveTo(10, 30);
      expect(describeTarget(session)).toEqual({ kind: 'list', key: target.state.key, index: 0 });

      release(10, 30);
      const expectMoved = () => {
        expect(titles(target)).toEqual(['Row A', 'Row T']);
        expect(rowA.parent).toBe(target);
        expect(titles(source)).toEqual(['Row B', 'Row C']);
      };
      expectMoved();
      expect(sidebar.state.undoStack).toHaveLength(1);

      sidebar.undoAction();
      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
      expect(rowA.parent).toBe(source);
      expect(titles(target)).toEqual(['Row T']);
      sidebar.redoAction();
      expectMoved();
    });

    it('moves the row into a rows layout nested in another row', () => {
      const nestedRow = new RowItem({ title: 'Nested' });
      const nested = new RowsLayoutManager({ rows: [nestedRow] });
      const { source, rowA, sidebar } = setup({ rowCLayout: nested });
      const nestedEl = renderList(nested);
      startDrag(rowA);

      elementsUnderPointer = [nestedEl, renderList(source)];
      moveTo(10, 80);
      release(10, 80);
      expect(titles(nested)).toEqual(['Nested', 'Row A']);
      expect(titles(source)).toEqual(['Row B', 'Row C']);
      expect(sidebar.state.undoStack).toHaveLength(1);

      sidebar.undoAction();
      expect(titles(nested)).toEqual(['Nested']);
      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
      sidebar.redoAction();
      expect(titles(nested)).toEqual(['Nested', 'Row A']);
      expect(rowA.parent).toBe(nested);
    });

    it('moves the row to the end of a tab whose header is hovered, and highlights that tab meanwhile', () => {
      const { source, target, targetTab, rowA, sidebar } = setup();
      const { session } = startDrag(rowA);

      elementsUnderPointer = [tabHeader(targetTab)];
      moveTo(10, 30);
      expect(describeTarget(session)).toEqual({ kind: 'tab', key: targetTab.state.key });
      expect(targetTab.state.isDropTarget).toBe(true);

      release(10, 30);
      expect(targetTab.state.isDropTarget).toBe(false);
      expect(titles(target)).toEqual(['Row T', 'Row A']);

      sidebar.undoAction();
      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
      expect(titles(target)).toEqual(['Row T']);
      sidebar.redoAction();
      expect(titles(target)).toEqual(['Row T', 'Row A']);
    });

    it('does not move the row when it is released over the header of its own tab', () => {
      const { source, sourceTab, rowA, sidebar } = setup();
      const { session } = startDrag(rowA);

      elementsUnderPointer = [tabHeader(sourceTab)];
      moveTo(10, 30);
      expect(session.getState()?.target).toBeNull();
      release(10, 30);

      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
      expect(sidebar.state.undoStack).toHaveLength(0);
    });
  });

  describe('into a tab that does not hold rows', () => {
    it("wraps the tab's own layout object in a new row next to the dropped row, and puts it back on undo", () => {
      const { source, gridTab, gridLayout, rowA, sidebar } = setup();
      const { session } = startDrag(rowA);

      elementsUnderPointer = [tabContent(gridTab)];
      moveTo(10, 30);
      expect(describeTarget(session)).toEqual({ kind: 'tab', key: gridTab.state.key });
      release(10, 30);

      const rows = gridTab.getLayout();
      const expectGrouped = () => {
        expect(gridTab.getLayout()).toBe(rows);
        expect(rows).toBeInstanceOf(RowsLayoutManager);
        const [contentRow, droppedRow] = (rows as RowsLayoutManager).state.rows;
        expect(contentRow.state.title).toBe('New row');
        expect(contentRow.getLayout()).toBe(gridLayout);
        expect(gridLayout.parent).toBe(contentRow);
        expect(droppedRow).toBe(rowA);
        expect(titles(source)).toEqual(['Row B', 'Row C']);
      };
      expectGrouped();
      expect(sidebar.state.undoStack).toHaveLength(1);

      sidebar.undoAction();
      expect(gridTab.getLayout()).toBe(gridLayout);
      expect(gridLayout.parent).toBe(gridTab);
      expect(gridLayout.getVizPanels().map((panel) => panel.state.title)).toEqual(['G1']);
      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
      expect(rowA.parent).toBe(source);

      sidebar.redoAction();
      expectGrouped();
    });

    it('replaces the layout of an empty tab with rows holding only the dropped row', () => {
      const { source, emptyTab, rowA, sidebar } = setup();
      const emptyLayout = emptyTab.getLayout();
      startDrag(rowA);

      elementsUnderPointer = [tabHeader(emptyTab)];
      moveTo(10, 30);
      release(10, 30);
      const rows = emptyTab.getLayout() as RowsLayoutManager;
      expect(titles(rows)).toEqual(['Row A']);

      sidebar.undoAction();
      expect(emptyTab.getLayout()).toBe(emptyLayout);
      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
      sidebar.redoAction();
      expect(emptyTab.getLayout()).toBe(rows);
      expect(titles(rows)).toEqual(['Row A']);
    });
  });

  describe('nesting rules', () => {
    it('does not drop a row into a rows layout inside itself, it goes into the list around it instead', () => {
      const inner = new RowsLayoutManager({ rows: [new RowItem({ title: 'Inner' })] });
      const { source, rowA, sidebar } = setup({ rowALayout: inner });
      const innerEl = renderList(inner);
      const sourceEl = renderList(source);
      const { session } = startDrag(rowA);

      elementsUnderPointer = [innerEl, sourceEl];
      moveTo(10, 260);
      expect(describeTarget(session)).toEqual({ kind: 'list', key: source.state.key, index: 2 });
      release(10, 260);

      expect(titles(source)).toEqual(['Row B', 'Row C', 'Row A']);
      expect(inner.state.rows).toHaveLength(1);
      expect(sidebar.state.undoStack).toHaveLength(1);
    });

    it('does not drop a row where its nested groups would go past the maximum depth', () => {
      // Rows nested four levels deep; Row A holds rows itself, so it can only go three levels deep
      const deepest = new RowsLayoutManager({ rows: [new RowItem({ title: 'Level 4' })] });
      const level3 = new RowsLayoutManager({ rows: [new RowItem({ title: 'Level 3', layout: deepest })] });
      const level2 = new RowsLayoutManager({ rows: [new RowItem({ title: 'Level 2', layout: level3 })] });
      const rowA = new RowItem({ title: 'Row A', layout: new RowsLayoutManager({ rows: [new RowItem()] }) });
      const rowGrid = new RowItem({ title: 'Grid row' });
      const source = new RowsLayoutManager({
        rows: [rowA, rowGrid, new RowItem({ title: 'Level 1', layout: level2 })],
      });
      activate(new DashboardScene({ isEditing: true, body: source }));
      elementsUnderPointer = [renderList(deepest), renderList(level3)];

      const first = startDrag(rowA).session;
      moveTo(10, 30);
      expect(describeTarget(first)).toEqual({ kind: 'list', key: level3.state.key, index: 0 });
      first.cancel();

      const second = startDrag(rowGrid).session;
      moveTo(10, 30);
      expect(describeTarget(second)).toEqual({ kind: 'list', key: deepest.state.key, index: 0 });
      second.cancel();
    });

    it('does not group a row into a tab when the new rows would go past the maximum depth', () => {
      // Row A holds two levels of rows, the tab is two levels deep and would get a level of rows itself
      const rowA = new RowItem({
        title: 'Row A',
        layout: new RowsLayoutManager({
          rows: [new RowItem({ layout: new RowsLayoutManager({ rows: [new RowItem()] }) })],
        }),
      });
      const rowB = new RowItem({ title: 'Row B' });
      const gridTab = new TabItem({ title: 'Grid', layout: gridWithPanel('G1') });
      const source = new RowsLayoutManager({
        rows: [rowA, rowB, new RowItem({ title: 'Tabs', layout: new TabsLayoutManager({ tabs: [gridTab] }) })],
      });
      activate(new DashboardScene({ isEditing: true, body: source }));
      elementsUnderPointer = [tabContent(gridTab)];

      const first = startDrag(rowA).session;
      moveTo(10, 30);
      expect(first.getState()?.target).toBeNull();
      first.cancel();

      const second = startDrag(rowB).session;
      moveTo(10, 30);
      expect(describeTarget(second)).toEqual({ kind: 'tab', key: gridTab.state.key });
      second.cancel();
      expect(gridTab.state.isDropTarget).toBe(false);
    });
  });

  describe('cancelling', () => {
    it('cancels on Escape without changing anything, also after hovering other places', () => {
      const { source, target, rowA, sidebar } = setup();
      elementsUnderPointer = [renderList(target)];
      const { session, host } = startDrag(rowA);
      moveTo(10, 30);

      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      window.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(true);
      expect(session.getState()).toBeNull();
      expect(host.onEnd).toHaveBeenCalledTimes(1);

      release(10, 30);
      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
      expect(target.state.rows).toHaveLength(1);
      expect(sidebar.state.undoStack).toHaveLength(0);
    });

    it('cancels when the pointer is released outside the window', () => {
      const { source, rowA, sidebar } = setup();
      elementsUnderPointer = [renderList(source)];
      startDrag(rowA);
      moveTo(10, 260);

      release(-5, 260);
      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
      expect(sidebar.state.undoStack).toHaveLength(0);
    });

    it('cancels when the pointer comes back without a button pressed, after a release outside the window', () => {
      const { source, rowA } = setup();
      elementsUnderPointer = [renderList(source)];
      const { session, host } = startDrag(rowA);
      moveTo(10, 260);

      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 260, buttons: 0 }));
      expect(session.getState()).toBeNull();
      expect(host.onEnd).toHaveBeenCalledTimes(1);
      release(10, 260);
      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
    });

    it('does not start dragging before the pointer moves past the threshold, and leaves Escape alone until then', () => {
      const { source, rowA } = setup();
      elementsUnderPointer = [renderList(source)];
      const { session, host } = startDrag(rowA);

      moveTo(10, 12);
      expect(session.getState()).toBeNull();
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      window.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(false);

      release(10, 12);
      expect(host.showPreview).not.toHaveBeenCalled();
      expect(host.onEnd).toHaveBeenCalledTimes(1);
      expect(titles(source)).toEqual(['Row A', 'Row B', 'Row C']);
    });

    it('does not start for presses on controls in the header or other buttons than the main one', () => {
      const { rowA } = setup();
      const button = document.createElement('button');

      expect(ListDragSession.start({ button: 0, clientX: 0, clientY: 0, target: button }, rowA, makeHost(rowA))).toBe(
        null
      );
      expect(ListDragSession.start({ button: 2, clientX: 0, clientY: 0, target: null }, rowA, makeHost(rowA))).toBe(
        null
      );
    });
  });

  describe('auto-scroll', () => {
    let frames: FrameRequestCallback[] = [];

    beforeEach(() => {
      frames = [];
      jest
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback: FrameRequestCallback) => frames.push(callback));
      jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    function runFrames(count: number) {
      for (let i = 0; i < count; i++) {
        const pending = frames;
        frames = [];
        pending.forEach((callback) => callback(0));
      }
    }

    /** The dashboard body, 600px high, with the rows from 500px down in its content */
    function renderScrollingList(list: RowsLayoutManager) {
      const body = document.createElement('div');
      body.setAttribute('data-testid', selectors.components.DashboardSidebarSplitter.bodyContainer);
      let scrollTop = 0;
      Object.defineProperties(body, {
        clientHeight: { value: 600 },
        scrollHeight: { value: 3000 },
        scrollTop: { get: () => scrollTop, set: (value: number) => (scrollTop = Math.min(Math.max(value, 0), 2400)) },
      });
      body.getBoundingClientRect = () => rect(0, 600);
      document.body.appendChild(body);
      const listEl = renderList(list);
      [...listEl.children].forEach((rowEl, index) => {
        (rowEl as HTMLElement).getBoundingClientRect = () => rect(500 + index * ROW_HEIGHT - scrollTop, ROW_HEIGHT);
      });
      return { body, listEl };
    }

    it('scrolls near the bottom of the dashboard and moves the drop position as the rows scroll under the pointer', () => {
      const { source, rowA } = setup();
      const { body, listEl } = renderScrollingList(source);
      elementsUnderPointer = [listEl];
      const { session, host } = startDrag(rowA);

      // Above the middle of Row B, which spans 600-700 before scrolling
      moveTo(10, 595);
      expect(describeTarget(session)).toEqual({ kind: 'list', key: source.state.key, index: 0 });

      runFrames(3);
      expect(body.scrollTop).toBeGreaterThan(50);
      expect(describeTarget(session)).toEqual({ kind: 'list', key: source.state.key, index: 1 });
      // The preview stays where it is in the viewport, under the pointer
      expect(host.movePreview).toHaveBeenCalledTimes(1);

      release(10, 595);
      expect(titles(source)).toEqual(['Row B', 'Row A', 'Row C']);
      const scrolled = body.scrollTop;
      runFrames(1);
      expect(body.scrollTop).toBe(scrolled);
    });
  });

  describe('tabs', () => {
    it('reorders the tabs of a tab bar live along it and commits the reorder as one undoable action', () => {
      const { outer, outerA, sidebar } = setupTabs();
      const barEl = renderTabBar(outer);
      const { session, host } = startDrag(outerA);

      elementsUnderPointer = [barEl];
      moveTo(30, 10);
      expect(session.getState()).toMatchObject({ itemKey: outerA.state.key, sourceListKey: outer.state.key });
      expect(describeTarget(session)).toEqual({ kind: 'list', key: outer.state.key, index: 0 });
      expect(host.showPreview).toHaveBeenCalledWith(expect.objectContaining({ type: 'tab', label: 'Outer A' }));

      // Past the middle of the last other tab (B spans 100-200, C 200-300)
      moveTo(260, 10);
      expect(describeTarget(session)).toEqual({ kind: 'list', key: outer.state.key, index: 2 });

      release(260, 10);
      expect(tabTitles(outer)).toEqual(['Outer B', 'Outer C', 'Outer A']);
      expect(sidebar.state.undoStack).toHaveLength(1);

      sidebar.undoAction();
      expect(tabTitles(outer)).toEqual(['Outer A', 'Outer B', 'Outer C']);
      sidebar.redoAction();
      expect(tabTitles(outer)).toEqual(['Outer B', 'Outer C', 'Outer A']);
    });

    it('does not add an undo step when the tab is dropped where it was', () => {
      const { outer, outerB, sidebar } = setupTabs();
      elementsUnderPointer = [renderTabBar(outer)];
      startDrag(outerB);

      moveTo(150, 10);
      release(150, 10);

      expect(tabTitles(outer)).toEqual(['Outer A', 'Outer B', 'Outer C']);
      expect(sidebar.state.undoStack).toHaveLength(0);
    });

    it('moves a nested tab out to the outer tab bar at the hovered position, where it opens', () => {
      const { outer, nested, inner2, sidebar } = setupTabs();
      renderTabBar(nested);
      const outerEl = renderTabBar(outer);
      const { session } = startDrag(inner2);

      elementsUnderPointer = [outerEl];
      moveTo(110, 10);
      expect(describeTarget(session)).toEqual({ kind: 'list', key: outer.state.key, index: 1 });

      release(110, 10);
      const expectMoved = () => {
        expect(tabTitles(outer)).toEqual(['Outer A', 'Inner 2', 'Outer B', 'Outer C']);
        expect(tabTitles(nested)).toEqual(['Inner 1']);
        expect(inner2.parent).toBe(outer);
        expect(outer.getCurrentTab()).toBe(inner2);
      };
      expectMoved();
      expect(sidebar.state.undoStack).toHaveLength(1);

      sidebar.undoAction();
      expect(tabTitles(outer)).toEqual(['Outer A', 'Outer B', 'Outer C']);
      expect(tabTitles(nested)).toEqual(['Inner 1', 'Inner 2']);
      expect(inner2.parent).toBe(nested);
      sidebar.redoAction();
      expectMoved();
    });

    it('does not drop a tab into the tab bar nested inside it', () => {
      const { outer, nested, outerA, sidebar } = setupTabs();
      renderTabBar(outer);
      const { session } = startDrag(outerA);

      // The nested tab bar sits in the content of the dragged tab, outside of the outer tab bar
      elementsUnderPointer = [renderTabBar(nested), tabContent(outerA)];
      moveTo(110, 10);
      expect(session.getState()?.target).toBeNull();
      release(110, 10);

      expect(tabTitles(outer)).toEqual(['Outer A', 'Outer B', 'Outer C']);
      expect(tabTitles(nested)).toEqual(['Inner 1', 'Inner 2']);
      expect(outerA.parent).toBe(outer);
      expect(sidebar.state.undoStack).toHaveLength(0);
    });

    it('does not drop a tab where its nested groups would go past the maximum depth', () => {
      // A tab bar three groups deep: a tab holding one more group fits, one holding two does not
      const deepBar = new TabsLayoutManager({ tabs: [new TabItem({ title: 'Deep' })] });
      const level2 = new RowsLayoutManager({ rows: [new RowItem({ title: 'Level 2', layout: deepBar })] });
      const twoLevels = new TabItem({
        title: 'Two levels',
        layout: new RowsLayoutManager({
          rows: [new RowItem({ layout: new RowsLayoutManager({ rows: [new RowItem()] }) })],
        }),
      });
      const oneLevel = new TabItem({ title: 'One level', layout: new RowsLayoutManager({ rows: [new RowItem()] }) });
      const outer = new TabsLayoutManager({
        tabs: [twoLevels, oneLevel, new TabItem({ title: 'Holder', layout: level2 })],
      });
      activate(new DashboardScene({ isEditing: true, body: outer }));
      elementsUnderPointer = [renderTabBar(deepBar)];

      const first = startDrag(twoLevels).session;
      moveTo(30, 10);
      expect(first.getState()?.target).toBeNull();
      first.cancel();

      const second = startDrag(oneLevel).session;
      moveTo(30, 10);
      expect(describeTarget(second)).toEqual({ kind: 'list', key: deepBar.state.key, index: 0 });
      second.cancel();
    });

    it('does not drop a tab on a rows layout or on the header of another tab', () => {
      const rows = new RowsLayoutManager({ rows: [new RowItem({ title: 'Row' })] });
      const { outer, outerB, outerC, sidebar } = setupTabs({ outerCLayout: rows });
      const { session } = startDrag(outerB);

      elementsUnderPointer = [tabHeader(outerC), renderList(rows)];
      moveTo(30, 10);
      expect(session.getState()?.target).toBeNull();
      expect(outerC.state.isDropTarget).toBeFalsy();
      release(30, 10);

      expect(tabTitles(outer)).toEqual(['Outer A', 'Outer B', 'Outer C']);
      expect(titles(rows)).toEqual(['Row']);
      expect(sidebar.state.undoStack).toHaveLength(0);
    });

    it('cancels on Escape over another tab bar without changing anything', () => {
      const { outer, nested, outerC, sidebar } = setupTabs();
      elementsUnderPointer = [renderTabBar(nested)];
      const { session, host } = startDrag(outerC);
      moveTo(30, 10);
      expect(describeTarget(session)).toEqual({ kind: 'list', key: nested.state.key, index: 0 });

      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      window.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(true);
      expect(session.getState()).toBeNull();
      expect(host.onEnd).toHaveBeenCalledTimes(1);

      release(30, 10);
      expect(tabTitles(outer)).toEqual(['Outer A', 'Outer B', 'Outer C']);
      expect(tabTitles(nested)).toEqual(['Inner 1', 'Inner 2']);
      expect(sidebar.state.undoStack).toHaveLength(0);
    });

    it('swallows the click of the release, which would open the dragged tab', () => {
      const { outer, outerA } = setupTabs();
      elementsUnderPointer = [renderTabBar(outer)];
      startDrag(outerA);
      moveTo(260, 10);
      release(260, 10);

      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      document.body.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
    });

    it('starts on a press on the tab header link, but not on other controls in it', () => {
      const { outerA } = setupTabs();
      const link = document.createElement('a');
      link.setAttribute('href', '#');
      link.setAttribute('role', 'tab');
      const button = document.createElement('button');

      const session = ListDragSession.start(
        { button: 0, clientX: 0, clientY: 0, target: link },
        outerA,
        makeHost(outerA)
      );
      expect(session).not.toBeNull();
      session?.cancel();
      expect(
        ListDragSession.start({ button: 0, clientX: 0, clientY: 0, target: button }, outerA, makeHost(outerA))
      ).toBeNull();
    });
  });

  function setupTabs({ outerCLayout }: { outerCLayout?: RowsLayoutManager } = {}) {
    const inner1 = new TabItem({ title: 'Inner 1' });
    const inner2 = new TabItem({ title: 'Inner 2' });
    const nested = new TabsLayoutManager({ tabs: [inner1, inner2] });
    const outerA = new TabItem({ title: 'Outer A', layout: nested });
    const outerB = new TabItem({ title: 'Outer B' });
    const outerC = new TabItem({ title: 'Outer C', ...(outerCLayout && { layout: outerCLayout }) });
    const outer = new TabsLayoutManager({ tabs: [outerA, outerB, outerC], currentTabSlug: outerA.getSlug() });
    const dashboard = new DashboardScene({ isEditing: true, body: outer });
    activate(dashboard);
    return { outer, nested, outerA, outerB, outerC, inner1, inner2, sidebar: dashboard.state.sidebar };
  }

  function setup({ rowALayout, rowCLayout }: { rowALayout?: RowsLayoutManager; rowCLayout?: RowsLayoutManager } = {}) {
    const rowA = new RowItem({ title: 'Row A', ...(rowALayout && { layout: rowALayout }) });
    const rowB = new RowItem({ title: 'Row B' });
    const rowC = new RowItem({ title: 'Row C', ...(rowCLayout && { layout: rowCLayout }) });
    const source = new RowsLayoutManager({ rows: [rowA, rowB, rowC] });
    const rowT = new RowItem({ title: 'Row T' });
    const target = new RowsLayoutManager({ rows: [rowT] });
    const gridLayout = gridWithPanel('G1');
    const sourceTab = new TabItem({ title: 'Source', layout: source });
    const targetTab = new TabItem({ title: 'Rows target', layout: target });
    const gridTab = new TabItem({ title: 'Grid', layout: gridLayout });
    const emptyTab = new TabItem({ title: 'Empty', layout: AutoGridLayoutManager.createEmpty() });
    const tabs = new TabsLayoutManager({ tabs: [sourceTab, targetTab, gridTab, emptyTab] });
    const dashboard = new DashboardScene({ isEditing: true, body: tabs });
    activate(dashboard);

    return {
      rowA,
      rowB,
      rowC,
      rowT,
      source,
      target,
      gridLayout,
      sourceTab,
      targetTab,
      gridTab,
      emptyTab,
      sidebar: dashboard.state.sidebar,
    };
  }

  function activate(dashboard: DashboardScene) {
    deactivate = activateFullSceneTree(dashboard);
  }

  function startDrag(item: ListItem) {
    const host = makeHost(item);
    const session = ListDragSession.start({ button: 0, clientX: 10, clientY: 10, target: null }, item, host);
    if (!session) {
      throw new Error('The drag did not start');
    }
    return { session, host };
  }
});

function makeHost(item: ListItem): jest.Mocked<ListDragHost> {
  const findDropTarget = createListDropTargetFinder(item);
  return {
    getDropTarget: jest.fn(findDropTarget),
    onDragMove: jest.fn(),
    showPreview: jest.fn(),
    movePreview: jest.fn(),
    onChange: jest.fn(),
    onEnd: jest.fn(),
  };
}

function moveTo(clientX: number, clientY: number) {
  window.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY, buttons: 1 }));
}

function release(clientX: number, clientY: number) {
  window.dispatchEvent(new MouseEvent('pointerup', { clientX, clientY }));
}

/** Drop targets hold scene objects, which can't be printed when an assertion fails */
function describeTarget(session: ListDragSession) {
  const target = session.getState()?.target;
  if (!target) {
    return target;
  }
  return target.kind === 'list'
    ? { kind: target.kind, key: target.list.state.key, index: target.index }
    : { kind: target.kind, key: target.tab.state.key };
}

function titles(list: RowsLayoutManager) {
  return list.state.rows.map((row) => row.state.title);
}

/** A list element with one element per row, stacked from the top of the page */
function renderList(list: RowsLayoutManager): HTMLElement {
  const listEl = document.createElement('div');
  listEl.setAttribute(LIST_DROP_KEY_ATTR, list.state.key!);
  list.state.rows.forEach((row, index) => {
    const rowEl = document.createElement('div');
    rowEl.setAttribute(LIST_ITEM_KEY_ATTR, row.state.key!);
    const top = index * ROW_HEIGHT;
    rowEl.getBoundingClientRect = () => rect(top, ROW_HEIGHT);
    listEl.appendChild(rowEl);
  });
  document.body.appendChild(listEl);
  return listEl;
}

function rect(top: number, height: number, left = 0, width = 1000): DOMRect {
  const box = { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height };
  return { ...box, toJSON: () => box };
}

const TAB_WIDTH = 100;

/** A tab bar element with one element per tab, side by side from the left of the page */
function renderTabBar(bar: TabsLayoutManager): HTMLElement {
  const barEl = document.createElement('div');
  barEl.setAttribute(LIST_DROP_KEY_ATTR, bar.state.key!);
  bar.state.tabs.forEach((tab, index) => {
    const tabEl = document.createElement('div');
    tabEl.setAttribute(LIST_ITEM_KEY_ATTR, tab.state.key!);
    tabEl.getBoundingClientRect = () => rect(0, 32, index * TAB_WIDTH, TAB_WIDTH);
    barEl.appendChild(tabEl);
  });
  document.body.appendChild(barEl);
  return barEl;
}

function tabTitles(bar: TabsLayoutManager) {
  return bar.state.tabs.map((tab) => tab.state.title);
}

function tabHeader(tab: TabItem): HTMLElement {
  const el = document.createElement('a');
  el.setAttribute(TAB_ACTIVATION_KEY_ATTR, tab.state.key!);
  return el;
}

function tabContent(tab: TabItem): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, tab.state.key!);
  return el;
}

function gridWithPanel(title: string) {
  return new AutoGridLayoutManager({
    layout: new AutoGridLayout({ children: [new AutoGridItem({ body: new VizPanel({ title, pluginId: 'table' }) })] }),
  });
}
