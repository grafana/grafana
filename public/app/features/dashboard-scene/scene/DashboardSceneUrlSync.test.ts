import { waitFor } from '@testing-library/react';

import { getPanelPlugin } from '@grafana/data/test';
import { locationService, setPluginImportUtils } from '@grafana/runtime';
import { NewSceneObjectAddedEvent, SceneQueryRunner, UrlSyncManager, VizPanel } from '@grafana/scenes';
import { type LibraryPanel } from '@grafana/schema';
import { setTestFlags, testWithFlags } from '@grafana/test-utils/unstable';
import * as libraryPanels from 'app/features/library-panels/state/api';

import * as panelEditor from '../panel-edit/openPanelEditor';
import { testWithViewport } from '../utils/mobileViewportTestUtils';
import { createDeferred } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { LibraryPanelBehavior } from './LibraryPanelBehavior';
import { dashboardViews } from './dashboardViewRegistry';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';

describe('DashboardSceneUrlSync', () => {
  describe('library panel editor loading', () => {
    beforeAll(() => {
      setPluginImportUtils({
        importPanelPlugin: async () => getPanelPlugin({}),
        getPanelPluginFromCache: () => undefined,
      });
    });
    it.each(['loaded', 'failed', 'cancelled'] as const)(
      'finishes loading when the library panel is %s',
      async (outcome) => {
        const pending = createDeferred<LibraryPanel>();
        const fetchPanel = jest.spyOn(libraryPanels, 'getLibraryPanel').mockReturnValue(pending.promise);
        const behavior = new LibraryPanelBehavior({ uid: 'library-a', name: 'Library A' });
        const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', $behaviors: [behavior] });
        const scene = new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([panel]) });
        try {
          scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });
          expect(scene.state.loadingView).toBe('editPanel');
          expect(fetchPanel).toHaveBeenCalledWith('library-a', true);
          if (outcome === 'cancelled') {
            scene.urlSync?.updateFromUrl({ editPanel: null });
            expect(behavior.isActive).toBe(false);
            expect(panel.isActive).toBe(false);
          }
          if (outcome === 'failed') {
            pending.reject(new Error('Library panel unavailable'));
          } else {
            pending.resolve({
              uid: 'library-a',
              name: 'Library A',
              type: 'text',
              version: 1,
              model: { type: 'text', title: 'Library A', options: {}, fieldConfig: { defaults: {}, overrides: [] } },
            });
          }
          await waitFor(() => expect(scene.state.loadingView).toBeUndefined());
          if (outcome === 'loaded') {
            expect(scene.state.editPanel?.state.panelRef.resolve()).toBe(panel);
          } else if (outcome === 'failed') {
            expect(panel.state._pluginLoadError).toBe('Unable to load library panel: library-a');
          } else {
            expect(scene.state.editPanel).toBeUndefined();
          }
          expect(behavior.isActive).toBe(false);
          expect(panel.isActive).toBe(false);
        } finally {
          scene.cancelPendingViews();
          fetchPanel.mockRestore();
        }
      }
    );

    describe('when entering edit mode is blocked on mobile', () => {
      testWithFlags({ 'grafana.mobileEditDeprecation': true });

      testWithViewport('mobile');

      it('does not wait on an unloaded library panel or start loading the editor', () => {
        const pending = createDeferred<LibraryPanel>();
        const fetchPanel = jest.spyOn(libraryPanels, 'getLibraryPanel').mockReturnValue(pending.promise);
        const behavior = new LibraryPanelBehavior({ uid: 'library-a', name: 'Library A' });
        const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', $behaviors: [behavior] });
        const scene = new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([panel]) });
        const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');
        try {
          scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });

          expect(onEnterEditMode).not.toHaveBeenCalled();
          expect(scene.state.isEditing).toBeFalsy();
          expect(scene.state.loadingView).toBeUndefined();
          expect(scene.state.editPanel).toBeUndefined();
          expect(scene.urlSync?.getUrlState().editPanel).toBeUndefined();
          // Nothing is left waiting: the library panel is neither fetched nor kept active
          expect(fetchPanel).not.toHaveBeenCalled();
          expect(behavior.isActive).toBeFalsy();
          expect(panel.isActive).toBeFalsy();
        } finally {
          scene.cancelPendingViews();
          fetchPanel.mockRestore();
        }
      });
    });
  });
  describe('Given a standard scene', () => {
    it('Should set UNSAFE_fitPanels when url has autofitpanels', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ autofitpanels: '' });
      const layout = scene.state.body as DefaultGridLayoutManager;

      expect(layout.state.grid.state.UNSAFE_fitPanels).toBe(true);
    });

    it('Should get the autofitpanels from the scene state', () => {
      const scene = buildTestScene();

      expect(scene.urlSync?.getUrlState().autofitpanels).toBeUndefined();
      const layout = scene.state.body as DefaultGridLayoutManager;
      layout.state.grid.setState({ UNSAFE_fitPanels: true });
      expect(scene.urlSync?.getUrlState().autofitpanels).toBe('true');
    });
  });

  describe('Scroll to row', () => {
    let scrollIntoViewSpy: jest.Mock;
    let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
    let locationPartialSpy: jest.SpyInstance;

    beforeEach(() => {
      // jsdom doesn't implement scrollIntoView, so patch the prototype rather than spy on it.
      originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
      scrollIntoViewSpy = jest.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
      locationPartialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    });

    afterEach(() => {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      locationPartialSpy.mockRestore();
      document.body.innerHTML = '';
    });

    it('scrolls the matching row into view', () => {
      const { scene, element } = buildTestSceneWithRow('Traces Instance Stats');

      scene.urlSync?.updateFromUrl({ drow: 'Traces-Instance-Stats' });

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(element);
    });

    it('expands a collapsed row', () => {
      const { scene, row } = buildTestSceneWithRow('Traces Instance Stats', { collapse: true });

      scene.urlSync?.updateFromUrl({ drow: 'Traces-Instance-Stats' });

      expect(row.state.collapse).toBe(false);
    });

    it('clears parameter from the url after scrolling so it acts as a one-shot action', () => {
      const { scene } = buildTestSceneWithRow('Traces Instance Stats');

      scene.urlSync?.updateFromUrl({ drow: 'Traces-Instance-Stats' });

      // replace: true so clearing drow does not push a history entry that Back would restore
      expect(locationPartialSpy).toHaveBeenCalledWith({ drow: null }, true);
    });

    it('expands all collapsed ancestor rows of a nested row', () => {
      const nestedRow = new RowItem({ title: 'Nested' });
      const middleRow = new RowItem({
        title: 'Middle',
        collapse: true,
        layout: new RowsLayoutManager({ rows: [nestedRow] }),
      });
      const outerRow = new RowItem({
        title: 'Outer',
        collapse: true,
        layout: new RowsLayoutManager({ rows: [middleRow] }),
      });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [outerRow] }),
      });

      scene.urlSync?.updateFromUrl({ drow: 'Outer/Middle/Nested' });

      expect(outerRow.state.collapse).toBe(false);
      expect(middleRow.state.collapse).toBe(false);
    });

    it('switches to a non-active tab containing the target row', () => {
      const targetRow = new RowItem({ title: 'Target row' });
      const activeTab = new TabItem({ title: 'Active tab' });
      const targetTab = new TabItem({
        title: 'Target tab',
        layout: new RowsLayoutManager({ rows: [targetRow] }),
      });
      const tabsLayout = new TabsLayoutManager({ tabs: [activeTab, targetTab] });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: tabsLayout,
      });
      tabsLayout.setState({ currentTabSlug: activeTab.getSlug() });

      scene.urlSync?.updateFromUrl({ drow: 'Target-tab/Target-row' });

      expect(tabsLayout.getCurrentTab()).toBe(targetTab);
    });

    it('scrolls the correct row when a nested row shares its slug with a top-level row', () => {
      const nestedRow = new RowItem({ title: 'Row 1' });
      const containerRow = new RowItem({ title: 'Row 2', layout: new RowsLayoutManager({ rows: [nestedRow] }) });
      const topLevelRow = new RowItem({ title: 'Row 1' });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [topLevelRow, containerRow] }),
      });

      const topLevelElement = document.createElement('div');
      document.body.appendChild(topLevelElement);
      topLevelRow.containerRef.current = topLevelElement;

      const nestedElement = document.createElement('div');
      document.body.appendChild(nestedElement);
      nestedRow.containerRef.current = nestedElement;

      scene.urlSync?.updateFromUrl({ drow: 'Row-2/Row-1' });
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(nestedElement);

      scene.urlSync?.updateFromUrl({ drow: 'Row-1' });
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
      expect(scrollIntoViewSpy.mock.instances[1]).toBe(topLevelElement);
    });

    it('distinguishes a row titled with a slash from a nested row with the same path segments', () => {
      const nestedRow = new RowItem({ title: 'Bar' });
      const parentRow = new RowItem({ title: 'Foo', layout: new RowsLayoutManager({ rows: [nestedRow] }) });
      const slashTitleRow = new RowItem({ title: 'Foo/Bar' });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [slashTitleRow, parentRow] }),
      });

      const slashTitleElement = document.createElement('div');
      document.body.appendChild(slashTitleElement);
      slashTitleRow.containerRef.current = slashTitleElement;

      const nestedElement = document.createElement('div');
      document.body.appendChild(nestedElement);
      nestedRow.containerRef.current = nestedElement;

      // Encoded slash in the title segment must not match nested Foo/Bar path
      scene.urlSync?.updateFromUrl({ drow: 'Foo%2FBar' });
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(slashTitleElement);

      scene.urlSync?.updateFromUrl({ drow: 'Foo/Bar' });
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
      expect(scrollIntoViewSpy.mock.instances[1]).toBe(nestedElement);
    });

    it('clears parameter but does not scroll when no row matches the slug', () => {
      const { scene } = buildTestSceneWithRow('Traces Instance Stats');

      scene.urlSync?.updateFromUrl({ drow: 'Does-Not-Exist' });

      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
      expect(locationPartialSpy).toHaveBeenCalledWith({ drow: null }, true);
    });

    it('matches a repeated row clone by its own slug, without the source row as a path segment', () => {
      const sourceRow = new RowItem({ title: 'Web A' });
      // Repeat clones live in the source row's repeatedRows state, so their scene graph
      // parent is the source row even though they render as its siblings
      const cloneRow = new RowItem({ title: 'Web B', repeatSourceKey: sourceRow.state.key });
      sourceRow.setState({ repeatedRows: [cloneRow] });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [sourceRow] }),
      });

      const cloneElement = document.createElement('div');
      document.body.appendChild(cloneElement);
      cloneRow.containerRef.current = cloneElement;

      scene.urlSync?.updateFromUrl({ drow: 'Web-B' });

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(cloneElement);
    });

    it('scrolls to a repeated row that is created after url sync, when the repeater announces it', () => {
      const sourceRow = new RowItem({ title: 'Web A' });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [sourceRow] }),
      });

      // On load the repeat variable has not resolved yet, so the clone does not exist
      scene.urlSync?.updateFromUrl({ drow: 'Web-B' });
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();

      // Simulate the repeater performing repeats: it creates the clones and publishes
      // NewSceneObjectAddedEvent when done
      const cloneRow = new RowItem({ title: 'Web B', repeatSourceKey: sourceRow.state.key });
      sourceRow.setState({ repeatedRows: [cloneRow] });
      const cloneElement = document.createElement('div');
      document.body.appendChild(cloneElement);
      cloneRow.containerRef.current = cloneElement;
      sourceRow.publishEvent(new NewSceneObjectAddedEvent(sourceRow), true);

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(cloneElement);

      // The retry is one-shot: later additions must not scroll again
      sourceRow.publishEvent(new NewSceneObjectAddedEvent(sourceRow), true);
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    });

    it('replaces a pending scroll target when a new drow arrives before the old one matched', () => {
      const sourceRow = new RowItem({ title: 'Web A' });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [sourceRow] }),
      });

      scene.urlSync?.updateFromUrl({ drow: 'Web-B' });
      scene.urlSync?.updateFromUrl({ drow: 'Web-C' });

      const cloneB = new RowItem({ title: 'Web B', repeatSourceKey: sourceRow.state.key });
      const cloneC = new RowItem({ title: 'Web C', repeatSourceKey: sourceRow.state.key });
      sourceRow.setState({ repeatedRows: [cloneB, cloneC] });
      for (const clone of [cloneB, cloneC]) {
        const element = document.createElement('div');
        document.body.appendChild(element);
        clone.containerRef.current = element;
      }
      sourceRow.publishEvent(new NewSceneObjectAddedEvent(sourceRow), true);

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(cloneC.containerRef.current);
    });

    describe('while the layout settles after load', () => {
      const originalResizeObserver = global.ResizeObserver;
      let resizeObservers: ControlledResizeObserver[];

      // Lets tests decide when layouts resize, unlike the global mock that reports once per observe()
      class ControlledResizeObserver {
        public observed: Element[] = [];

        public constructor(public callback: ResizeObserverCallback) {
          resizeObservers.push(this);
        }

        public observe(target: Element) {
          this.observed.push(target);
        }

        public unobserve() {}

        public disconnect() {
          this.observed = [];
        }
      }

      function resizeLayout() {
        for (const observer of resizeObservers) {
          if (observer.observed.length > 0) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            observer.callback([], observer as unknown as ResizeObserver);
          }
        }
      }

      beforeEach(() => {
        jest.useFakeTimers();
        resizeObservers = [];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        global.ResizeObserver = ControlledResizeObserver as unknown as typeof ResizeObserver;
      });

      afterEach(() => {
        global.ResizeObserver = originalResizeObserver;
        jest.useRealTimers();
      });

      it('scrolls the row back into view when the layout above it renders', () => {
        const { scene, element } = buildTestSceneWithRow('Metrics');

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });
        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);

        resizeLayout();

        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
        expect(scrollIntoViewSpy.mock.instances[1]).toBe(element);
      });

      it('watches the ancestors of the row, since content above it grows those', () => {
        const { scene, element } = buildTestSceneWithRow('Metrics');

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });

        expect(resizeObservers[0].observed).toEqual([element, document.body, document.documentElement]);
      });

      it('waits for the row to render before following it', () => {
        const row = new RowItem({ title: 'Metrics' });
        const scene = new DashboardScene({
          title: 'hello',
          uid: 'dash-1',
          body: new RowsLayoutManager({ rows: [row] }),
        });

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });
        expect(resizeObservers).toHaveLength(0);

        const element = document.createElement('div');
        document.body.appendChild(element);
        row.containerRef.current = element;
        jest.advanceTimersByTime(16);
        expect(resizeObservers[0].observed[0]).toBe(element);

        scrollIntoViewSpy.mockClear();
        resizeLayout();

        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
        expect(scrollIntoViewSpy.mock.instances[0]).toBe(element);
      });

      it('stops following the row once the layout has settled', () => {
        const { scene } = buildTestSceneWithRow('Metrics');

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });
        resizeLayout();
        jest.advanceTimersByTime(1000);
        resizeLayout();

        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
      });

      it('keeps following the row while the layout is still resizing', () => {
        const { scene } = buildTestSceneWithRow('Metrics');

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });
        for (let i = 0; i < 3; i++) {
          resizeLayout();
          jest.advanceTimersByTime(900);
        }
        resizeLayout();

        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(5);
      });

      it('keeps following the row when the dashboard is deactivated and activated again', () => {
        // StrictMode does this in development right after url sync handled the row link
        const { scene } = buildTestSceneWithRow('Metrics');

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });
        const deactivate = scene.activate();
        deactivate();
        scene.activate();
        resizeLayout();

        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
      });

      it('stops following the row once it is removed from the page', () => {
        const { scene, element } = buildTestSceneWithRow('Metrics');

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });
        element.remove();
        resizeLayout();

        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
        expect(resizeObservers[0].observed).toEqual([]);
      });

      it('stops following the row and its running scroll animation once the user scrolls', () => {
        const { scene } = buildTestSceneWithRow('Metrics');
        const scrollToSpy = jest.spyOn(Element.prototype, 'scrollTo');
        document.documentElement.scrollTop = 120;

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });
        window.dispatchEvent(new WheelEvent('wheel'));
        resizeLayout();

        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
        expect(scrollToSpy.mock.contexts).toEqual([document.body, document.documentElement]);
        expect(scrollToSpy).toHaveBeenLastCalledWith({ top: 120, left: 0, behavior: 'instant' });
        scrollToSpy.mockRestore();
        document.documentElement.scrollTop = 0;
      });

      it('stops following the row when the user presses a key that scrolls the page', () => {
        const { scene } = buildTestSceneWithRow('Metrics');

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp' }));
        resizeLayout();

        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      });

      it('keeps following the row when the user presses a key that does not scroll the page', () => {
        const { scene } = buildTestSceneWithRow('Metrics');

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta' }));
        resizeLayout();

        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
      });

      it('lets the last scroll animation finish once the layout has settled', () => {
        const { scene } = buildTestSceneWithRow('Metrics');
        const scrollToSpy = jest.spyOn(Element.prototype, 'scrollTo');

        scene.urlSync?.updateFromUrl({ drow: 'Metrics' });
        resizeLayout();
        jest.advanceTimersByTime(1000);
        window.dispatchEvent(new WheelEvent('wheel'));

        expect(scrollToSpy).not.toHaveBeenCalled();
        scrollToSpy.mockRestore();
      });

      it('stops following the previous row when a new row link arrives', () => {
        const first = new RowItem({ title: 'First' });
        const second = new RowItem({ title: 'Second' });
        const scene = new DashboardScene({
          title: 'hello',
          uid: 'dash-1',
          body: new RowsLayoutManager({ rows: [first, second] }),
        });
        for (const row of [first, second]) {
          const element = document.createElement('div');
          document.body.appendChild(element);
          row.containerRef.current = element;
        }

        scene.urlSync?.updateFromUrl({ drow: 'First' });
        scene.urlSync?.updateFromUrl({ drow: 'Second' });
        scrollIntoViewSpy.mockClear();
        resizeLayout();

        expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
        expect(scrollIntoViewSpy.mock.instances[0]).toBe(second.containerRef.current);
      });
    });
  });

  describe('entering edit mode', () => {
    it('retains the newer URL hold when an older request for the same panel completes', async () => {
      const scene = buildTestScene();
      const first = createDeferred<void>();
      const second = createDeferred<void>();
      const original = dashboardViews.editPanel;
      const ready = [first, second];
      const loadEditor = jest.spyOn(dashboardViews, 'editPanel').mockImplementation((...args) => {
        const view = original(...args);
        const pending = ready.shift()!;
        return {
          ...view,
          load: async (signal) => {
            await pending.promise;
            return view.load(signal);
          },
        };
      });
      const openEditor = jest.spyOn(panelEditor, 'openPanelEditor');
      try {
        scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });
        scene.urlSync?.updateFromUrl({ editPanel: null });
        scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });
        first.resolve();
        await openEditor.mock.results[0].value;
        expect(scene.state.loadingView).toBe('editPanel');
        expect(scene.urlSync?.getUrlState().editPanel).toBe('panel-1');
        second.resolve();
        await openEditor.mock.results[1].value;
        expect(scene.state.editPanel?.getUrlKey()).toBe('1');
        expect(scene.state.loadingView).toBeUndefined();
      } finally {
        first.resolve();
        second.resolve();
        scene.cancelPendingViews();
        openEditor.mockRestore();
        loadEditor.mockRestore();
      }
    });

    it('preserves a deep-linked panel editor while entering dashboard edit mode', async () => {
      locationService.push('/d/test/test?editPanel=1');
      const scene = buildTestScene();
      const urlSync = new UrlSyncManager();
      try {
        urlSync.initSync(scene);
        expect(locationService.getSearchObject().editPanel).toBe('1');
        await waitFor(() => expect(scene.state.editPanel?.getUrlKey()).toBe('1'));
      } finally {
        urlSync.cleanUp(scene);
      }
    });

    it('keeps the URL and selected edit view in sync after successive updates', async () => {
      const scene = buildTestScene();
      scene.setState({
        editable: true,
        isEditing: true,
        meta: { ...scene.state.meta, canEdit: true },
      });

      scene.urlSync?.updateFromUrl({ editview: 'settings' });
      expect(scene.urlSync?.getUrlState().editview).toBe('settings');

      scene.urlSync?.updateFromUrl({ editview: 'variables' });
      expect(scene.urlSync?.getUrlState().editview).toBe('variables');

      await waitFor(() => expect(scene.state.editview?.getUrlKey()).toBe('variables'));
    });

    describe('direct ?editview= url load, not already editing', () => {
      it('enters edit mode and opens the editview pane once onEnterEditMode succeeds', async () => {
        const scene = buildTestScene();
        scene.setState({
          editable: true,
          isEditing: false,
          meta: { ...scene.state.meta, canEdit: true },
        });

        scene.urlSync?.updateFromUrl({ editview: 'links' });

        await waitFor(() => expect(scene.state.isEditing).toBe(true));
        expect(scene.state.editview?.getUrlKey()).toBe('links');
      });

      describe('on a mobile viewport', () => {
        testWithFlags({ 'grafana.mobileEditDeprecation': true });

        testWithViewport('mobile');

        it('does not enter edit mode or open the editview pane on mobile', async () => {
          const scene = buildTestScene();
          scene.setState({
            editable: true,
            isEditing: false,
            meta: { ...scene.state.meta, canEdit: true },
          });
          const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');

          scene.urlSync?.updateFromUrl({ editview: 'links' });
          // The honoured path enters edit mode in a setTimeout, so wait a tick before asserting it never happened.
          await new Promise((resolve) => setTimeout(resolve));

          expect(onEnterEditMode).not.toHaveBeenCalled();
          expect(scene.state.isEditing).toBe(false);
          expect(scene.state.editview).toBeUndefined();
        });

        it('removes ?editview= from the url once entering edit mode is blocked on mobile', async () => {
          locationService.push('/d/test/test?editview=links');
          const scene = buildTestScene();
          scene.setState({
            editable: true,
            isEditing: false,
            meta: { ...scene.state.meta, canEdit: true },
          });
          const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');
          const urlSync = new UrlSyncManager();
          try {
            urlSync.initSync(scene);

            await waitFor(() => expect(locationService.getSearchObject().editview).toBeUndefined());
            expect(onEnterEditMode).not.toHaveBeenCalled();
          } finally {
            urlSync.cleanUp(scene);
          }
        });

        it('does not start the panel editor when entering edit mode is blocked on mobile', () => {
          const scene = buildTestScene();
          scene.setState({ isEditing: false });
          const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');

          scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });

          expect(onEnterEditMode).not.toHaveBeenCalled();
          expect(scene.state.isEditing).toBe(false);
          expect(scene.state.editPanel).toBeUndefined();
          expect(scene.state.loadingView).toBeUndefined();
          expect(scene.urlSync?.getUrlState().editPanel).toBeUndefined();
        });

        it('removes ?editPanel= from the url once entering edit mode is blocked on mobile', async () => {
          locationService.push('/d/test/test?editPanel=1');
          const scene = buildTestScene();
          scene.setState({ isEditing: false });
          const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');
          const urlSync = new UrlSyncManager();
          try {
            urlSync.initSync(scene);

            await waitFor(() => expect(locationService.getSearchObject().editPanel).toBeUndefined());
            expect(onEnterEditMode).not.toHaveBeenCalled();
          } finally {
            urlSync.cleanUp(scene);
          }
        });

        it('still applies the other url updates from the same pass when entering edit mode is blocked on mobile', () => {
          const scene = buildTestScene();
          scene.setState({ isEditing: false });
          const grid = (scene.state.body as DefaultGridLayoutManager).state.grid;
          expect(grid.state.UNSAFE_fitPanels).toBeFalsy();

          scene.urlSync?.updateFromUrl({ editPanel: 'panel-1', autofitpanels: '' });

          expect(scene.state.editPanel).toBeUndefined();
          expect(grid.state.UNSAFE_fitPanels).toBe(true);
        });

        it('still opens the editview pane for a session already in full editing on a mobile viewport', async () => {
          const scene = buildTestScene();
          scene.setState({ editable: true, isEditing: true, meta: { ...scene.state.meta, canEdit: true } });

          scene.urlSync?.updateFromUrl({ editview: 'links' });

          await waitFor(() => expect(scene.state.editview?.getUrlKey()).toBe('links'));
        });

        it('does not open the editview pane for a Viewing session on a mobile viewport', async () => {
          setTestFlags({
            dashboardNewLayouts: true,
            'grafana.dashboardPreviewMode': true,
            'grafana.mobileEditDeprecation': true,
          });
          const scene = buildTestScene();
          scene.setState({
            editable: true,
            isEditing: true,
            mode: 'view',
            meta: { ...scene.state.meta, canEdit: true },
          });

          scene.urlSync?.updateFromUrl({ editview: 'links' });
          // The honoured path enters edit mode in a setTimeout, so wait a tick before asserting it never happened.
          await new Promise((resolve) => setTimeout(resolve));

          expect(scene.state.editview).toBeUndefined();
        });
      });
    });

    // must click "Make editable" first -- so ?editview= must not open a pane.
    it('removes ?editview= from the url when the dashboard can be edited but is not yet editable', async () => {
      locationService.push('/d/test/test?editview=links');
      const scene = buildTestScene();
      scene.setState({ editable: false, isEditing: false, meta: { ...scene.state.meta, canEdit: true } });
      const urlSync = new UrlSyncManager();
      try {
        urlSync.initSync(scene);

        await waitFor(() => expect(locationService.getSearchObject().editview).toBeUndefined());
        expect(scene.state.editview).toBeUndefined();
        expect(scene.state.isEditing).toBe(false);
      } finally {
        urlSync.cleanUp(scene);
      }
    });

    it('opens the editor when the same URL update closes panel view and already-closed settings', async () => {
      const scene = buildTestScene();
      scene.setState({ isEditing: false });
      scene.urlSync?.updateFromUrl({ viewPanel: 'panel-1' });
      expect(scene.state.viewPanel).toBeDefined();
      scene.urlSync?.updateFromUrl({ editPanel: 'panel-1', editview: null });
      // The panel editor is code split, so editPanel lands in a follow-up state update.
      await waitFor(() => expect(scene.state.editPanel).toBeDefined());
      expect(scene.state.viewPanel).toBeUndefined();
    });

    it('does not reopen the editor when URL sync closes it before its chunk arrives', async () => {
      const scene = buildTestScene();
      scene.setState({ isEditing: true });
      const openEditor = jest.spyOn(panelEditor, 'openPanelEditor');
      try {
        scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });
        expect(scene.urlSync?.getUrlState().editPanel).toBe('panel-1');
        const editing = openEditor.mock.results[0].value;

        scene.urlSync?.updateFromUrl({ editPanel: null });
        await editing;

        expect(scene.state.editPanel).toBeUndefined();
        expect(scene.urlSync?.getUrlState().editPanel).toBeUndefined();

        scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });
        await openEditor.mock.results[1].value;
        expect(scene.state.editPanel?.getUrlKey()).toBe('1');
      } finally {
        openEditor.mockRestore();
      }
    });
  });

  describe('while planning', () => {
    const planning = {
      phase: 'preview' as const,
      planId: 'plan-1',
      planTitle: 'Kafka overview',
      onBuild: jest.fn(),
      onDismiss: jest.fn(),
    };

    it('does not open dashboard settings from an editview url param, and does not enter edit mode', () => {
      const scene = buildTestScene();
      scene.setState({ isEditing: false, planning });
      jest.spyOn(scene, 'canEditDashboard').mockReturnValue(true);
      const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');

      scene.urlSync?.updateFromUrl({ editview: 'settings' });

      expect(scene.state.editview).toBeUndefined();
      expect(scene.state.isEditing).toBe(false);
      expect(onEnterEditMode).not.toHaveBeenCalled();
    });

    it('does not open the panel editor from an editPanel url param, and does not enter edit mode', () => {
      // Without this guard, the branch below calls onEnterEditMode() directly when not already
      // editing, undoing the invariant the static preview depends on.
      const scene = buildTestScene();
      scene.setState({ isEditing: false, planning });
      const onEnterEditMode = jest.spyOn(scene, 'onEnterEditMode');

      scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });

      expect(scene.state.editPanel).toBeUndefined();
      expect(scene.state.isEditing).toBe(false);
      expect(onEnterEditMode).not.toHaveBeenCalled();
    });

    it('does not open the share drawer from a shareView url param', () => {
      // Share is guarded elsewhere too (keyboard shortcuts; no menu at all on a preview panel)
      // -- this is a third route to the same action.
      const scene = buildTestScene();
      scene.setState({ planning });

      scene.urlSync?.updateFromUrl({ shareView: 'snapshot' });

      expect(scene.state.overlay).toBeUndefined();
      expect(scene.state.shareView).toBeUndefined();
    });

    it('does not open the view-panel pane from a viewPanel url param', () => {
      // Preview panels have no menu, so View isn't reachable that way -- but ?viewPanel= reaches
      // the same pane directly, whose Quick toggles section is plugin-gated, not isPlanning()-gated.
      const scene = buildTestScene();
      scene.setState({ planning });

      scene.urlSync?.updateFromUrl({ viewPanel: 'panel-1' });

      expect(scene.state.viewPanel).toBeUndefined();
    });
  });
});

function buildTestSceneWithRow(title: string, { collapse }: { collapse?: boolean } = {}) {
  const row = new RowItem({ title, collapse });
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: new RowsLayoutManager({ rows: [row] }),
  });

  // simulate the row being rendered
  const element = document.createElement('div');
  document.body.appendChild(element);
  row.containerRef.current = element;

  return { scene, row, element };
}

function buildTestScene() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
      }),

      new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    ]),
  });

  return scene;
}
