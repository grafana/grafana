import { waitFor } from '@testing-library/react';

import { locationService } from '@grafana/runtime';
import { NewSceneObjectAddedEvent, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';

describe('DashboardSceneUrlSync', () => {
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
  });

  describe('entering edit mode', () => {
    it('it should be possible to go from the view panel view to the edit view when the dashboard is not in edit mdoe', async () => {
      const scene = buildTestScene();
      scene.setState({ isEditing: false });
      scene.urlSync?.updateFromUrl({ viewPanel: 'panel-1' });
      expect(scene.state.viewPanel).toBeDefined();
      scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });
      // The panel editor is code split, so editPanel lands in a follow-up state update.
      await waitFor(() => expect(scene.state.editPanel).toBeDefined());
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
